import asyncio
from dataclasses import dataclass

from pymongo import MongoClient

from app.repositories.faiss_repository import FaissRepository
from app.repositories.mongo_repository import MongoResumeRepository
from app.services.embedding_service import EmbeddingService


@dataclass
class AppContainer:
    mongo_client: MongoClient
    mongo_repository: MongoResumeRepository
    faiss_repository: FaissRepository
    embedding_service: EmbeddingService
    write_lock: asyncio.Lock
