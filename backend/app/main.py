import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

from app.config import get_settings
from app.repositories.faiss_repository import FaissRepository
from app.repositories.mongo_repository import MongoResumeRepository
from app.routers.resumes import router as resumes_router
from app.services.embedding_service import EmbeddingService
from app.state.container import AppContainer


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    settings = get_settings()
    mongo_client = MongoClient(settings.mongo_uri)
    database = mongo_client[settings.mongo_db_name]
    collection = database["resumes"]

    container = AppContainer(
        mongo_client=mongo_client,
        mongo_repository=MongoResumeRepository(collection),
        faiss_repository=FaissRepository(
            index_path=settings.faiss_index_path,
            idmap_path=settings.faiss_idmap_path,
            dimension=384,
        ),
        embedding_service=EmbeddingService(settings.embedding_model),
        write_lock=asyncio.Lock(),
    )

    fastapi_app.state.container = container

    try:
        yield
    finally:
        mongo_client.close()


app = FastAPI(title="Semantic Resume Retrieval", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resumes_router)


@app.get("/health")
def health() -> dict[str, str | int]:
    return {
        "status": "ok",
        "service": "semantic-resume-retrieval",
        "version": 1,
    }
