import asyncio
from dataclasses import dataclass

from pymongo import MongoClient

from app.repositories.faiss_repository import EnsembleFaissRepository
from app.repositories.identity_repository import MongoIdentityRepository
from app.repositories.mongo_repository import MongoUploadJobRepository
from app.repositories.mongo_repository import MongoResumeRepository
from app.repositories.supabase_storage_repository import SupabaseStorageRepository
from app.services.embedding_service import EnsembleEmbeddingService


@dataclass
class AppContainer:
    mongo_client: MongoClient
    mongo_repository: MongoResumeRepository
    upload_job_repository: MongoUploadJobRepository
    identity_repository: MongoIdentityRepository
    faiss_repository: EnsembleFaissRepository
    storage_repository: SupabaseStorageRepository
    embedding_service: EnsembleEmbeddingService
    write_lock: asyncio.Lock
    ensemble_fusion_k: int = 60
