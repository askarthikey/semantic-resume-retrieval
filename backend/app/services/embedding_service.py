import numpy as np
from sentence_transformers import SentenceTransformer


class EmbeddingService:
    def __init__(self, model_name: str):
        self._model = SentenceTransformer(model_name)

    def embed_text(self, text: str) -> np.ndarray:
        vector = self._model.encode(text or "", convert_to_numpy=True, normalize_embeddings=False)
        vector = np.asarray(vector, dtype=np.float32)
        norm = np.linalg.norm(vector)
        if norm == 0.0:
            return vector
        return vector / norm
