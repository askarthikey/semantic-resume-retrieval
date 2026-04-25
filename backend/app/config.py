from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "resume_retrieval"
    faiss_index_path: str = "./faiss_store/index.bin"
    faiss_idmap_path: str = "./faiss_store/id_map.json"
    embedding_model: str = "all-MiniLM-L6-v2"
    ensemble_models: str = "all-MiniLM-L6-v2,all-mpnet-base-v2,multi-qa-MiniLM-L6-cos-v1"
    ensemble_fusion_k: int = 60
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_bucket: str = "resumes"
    supabase_path_prefix: str = "resumes"
    supabase_signed_url_ttl_seconds: int = 3600
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_seconds: int = 3600

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def ensemble_models_list(self) -> list[str]:
        return [m.strip() for m in self.ensemble_models.split(",") if m.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
