import json
import os
from pathlib import Path

import faiss
import numpy as np


class FaissRepository:
    def __init__(self, index_path: str, idmap_path: str, dimension: int = 384):
        self.index_path = Path(index_path)
        self.idmap_path = Path(idmap_path)
        self.dimension = dimension
        self.index = self._load_index()
        self.id_map = self._load_id_map()

        if self.index.ntotal != len(self.id_map):
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_map = []
            self.persist()

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

    def add(self, vector: np.ndarray, mongo_id: str) -> int:
        if vector.shape[0] != self.dimension:
            raise ValueError(f"Expected vector of size {self.dimension}, got {vector.shape[0]}")
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
