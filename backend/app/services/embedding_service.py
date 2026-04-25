import re
from dataclasses import dataclass

import numpy as np
from sentence_transformers import SentenceTransformer


@dataclass(frozen=True)
class ModelInfo:
    name: str
    slug: str
    dimension: int


def _slugify(model_name: str) -> str:
    """Convert a model name like 'all-MiniLM-L6-v2' to 'all_minilm_l6_v2'."""
    return re.sub(r"[^a-z0-9]+", "_", model_name.lower()).strip("_")


class EnsembleEmbeddingService:
    """Loads multiple sentence-transformer models and produces per-model embeddings."""

    def __init__(self, model_names: list[str]):
        if not model_names:
            raise ValueError("At least one model name is required")

        self._models: dict[str, SentenceTransformer] = {}
        self._infos: dict[str, ModelInfo] = {}

        for name in model_names:
            slug = _slugify(name)
            model = SentenceTransformer(name)
            dim = model.get_sentence_embedding_dimension()
            self._models[slug] = model
            self._infos[slug] = ModelInfo(name=name, slug=slug, dimension=dim)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_models(self) -> list[ModelInfo]:
        """Return metadata about each loaded model."""
        return list(self._infos.values())

    def embed_text(self, text: str) -> dict[str, np.ndarray]:
        """Embed *text* with every model. Returns ``{slug: L2-normalised vector}``."""
        results: dict[str, np.ndarray] = {}
        for slug, model in self._models.items():
            vector = model.encode(text or "", convert_to_numpy=True, normalize_embeddings=False)
            vector = np.asarray(vector, dtype=np.float32)
            norm = np.linalg.norm(vector)
            if norm != 0.0:
                vector = vector / norm
            results[slug] = vector
        return results

    def embed_text_single(self, text: str, slug: str) -> np.ndarray:
        """Embed with a specific model only (used for back-compat helpers)."""
        model = self._models.get(slug)
        if model is None:
            raise KeyError(f"Unknown model slug: {slug}")
        vector = model.encode(text or "", convert_to_numpy=True, normalize_embeddings=False)
        vector = np.asarray(vector, dtype=np.float32)
        norm = np.linalg.norm(vector)
        if norm != 0.0:
            vector = vector / norm
        return vector
