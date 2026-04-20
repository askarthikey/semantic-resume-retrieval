import asyncio
from dataclasses import dataclass

from pymongo import MongoClient

from app.repositories.faiss_repository import FaissRepository
from app.repositories.identity_repository import MongoIdentityRepository
from app.repositories.mongo_repository import MongoUploadJobRepository
from app.repositories.mongo_repository import MongoResumeRepository
from app.repositories.supabase_storage_repository import SupabaseStorageRepository
from app.services.embedding_service import EmbeddingService


@dataclass
class AppContainer:
    mongo_client: MongoClient
    mongo_repository: MongoResumeRepository
    upload_job_repository: MongoUploadJobRepository
    identity_repository: MongoIdentityRepository
    faiss_repository: FaissRepository
    storage_repository: SupabaseStorageRepository
    embedding_service: EmbeddingService
    write_lock: asyncio.Lock
