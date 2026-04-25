import json
import os
from pathlib import Path

import faiss
import numpy as np


class _SingleFaissIndex:
    """Manages one FAISS flat-IP index with an id-map file."""

    def __init__(self, index_path: Path, idmap_path: Path, dimension: int):
        self.index_path = index_path
        self.idmap_path = idmap_path
        self.dimension = dimension
        self.index = self._load_index()
        self.id_map: list[str] = self._load_id_map()

        if self.index.ntotal != len(self.id_map):
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_map = []
            self.persist()

    # -- loaders --------------------------------------------------------

    def _load_index(self) -> faiss.Index:
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        if self.index_path.exists():
            try:
                return faiss.read_index(str(self.index_path))
            except Exception:
                return faiss.IndexFlatIP(self.dimension)
        return faiss.IndexFlatIP(self.dimension)

    def _load_id_map(self) -> list[str]:
        self.idmap_path.parent.mkdir(parents=True, exist_ok=True)
        if self.idmap_path.exists():
            try:
                return json.loads(self.idmap_path.read_text(encoding="utf-8"))
            except Exception:
                return []
        return []

    # -- mutations ------------------------------------------------------

    def add(self, vector: np.ndarray, mongo_id: str) -> int:
        if vector.shape[0] != self.dimension:
            raise ValueError(f"Expected dim {self.dimension}, got {vector.shape[0]}")
        row = np.expand_dims(vector, axis=0).astype(np.float32)
        self.index.add(row)
        faiss_id = len(self.id_map)
        self.id_map.append(mongo_id)
        self.persist()
        return faiss_id

    def search(self, query_vector: np.ndarray, top_k: int) -> tuple[np.ndarray, np.ndarray]:
        if self.index.ntotal == 0:
            return np.array([[]], dtype=np.float32), np.array([[]], dtype=np.int64)
        row = np.expand_dims(query_vector, axis=0).astype(np.float32)
        return self.index.search(row, min(top_k, self.index.ntotal))

    def persist(self) -> None:
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self.idmap_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_index = self.index_path.with_suffix(".tmp")
        tmp_map = self.idmap_path.with_suffix(".tmp")
        faiss.write_index(self.index, str(tmp_index))
        tmp_map.write_text(json.dumps(self.id_map), encoding="utf-8")
        os.replace(tmp_index, self.index_path)
        os.replace(tmp_map, self.idmap_path)

    def reset(self) -> None:
        """Wipe the index and id-map to empty state."""
        self.index = faiss.IndexFlatIP(self.dimension)
        self.id_map = []
        self.persist()


class EnsembleFaissRepository:
    """Manages one FAISS index per embedding model slug."""

    def __init__(self, store_dir: str, model_dimensions: dict[str, int]):
        """
        Parameters
        ----------
        store_dir : str
            Root directory for all FAISS files (e.g. ``./faiss_store``).
        model_dimensions : dict[str, int]
            Mapping of model slug → embedding dimension.
        """
        self._store_dir = Path(store_dir)
        self._store_dir.mkdir(parents=True, exist_ok=True)
        self._indices: dict[str, _SingleFaissIndex] = {}

        for slug, dim in model_dimensions.items():
            idx_path = self._store_dir / f"index_{slug}.bin"
            map_path = self._store_dir / f"id_map_{slug}.json"
            self._indices[slug] = _SingleFaissIndex(idx_path, map_path, dim)

    # -- public ---------------------------------------------------------

    @property
    def slugs(self) -> list[str]:
        return list(self._indices.keys())

    def is_empty(self) -> bool:
        """True when *all* sub-indices are empty."""
        return all(idx.index.ntotal == 0 for idx in self._indices.values())

    def total_vectors(self) -> int:
        """Number of vectors in the first sub-index (they should all be equal)."""
        for idx in self._indices.values():
            return idx.index.ntotal
        return 0

    def get_id_map(self, slug: str) -> list[str]:
        return self._indices[slug].id_map

    def add(self, vectors: dict[str, np.ndarray], mongo_id: str) -> None:
        """Add one document's vectors across all models atomically."""
        for slug, vec in vectors.items():
            if slug in self._indices:
                self._indices[slug].add(vec, mongo_id)

    def search(self, query_vectors: dict[str, np.ndarray], top_k: int) -> dict[str, list[tuple[str, float]]]:
        """
        Search each sub-index and return per-model ranked lists.

        Returns
        -------
        dict[str, list[tuple[str, float]]]
            ``{slug: [(mongo_id, score), ...]}`` sorted by descending score.
        """
        results: dict[str, list[tuple[str, float]]] = {}
        for slug, vec in query_vectors.items():
            idx = self._indices.get(slug)
            if idx is None:
                continue
            distances, ids = idx.search(vec, top_k)
            ranked: list[tuple[str, float]] = []
            for score, fid in zip(distances[0], ids[0]):
                if fid < 0 or fid >= len(idx.id_map):
                    continue
                ranked.append((idx.id_map[int(fid)], float(score)))
            results[slug] = ranked
        return results

    def reset_all(self) -> None:
        """Wipe every sub-index (used during clean migration)."""
        for idx in self._indices.values():
            idx.reset()
