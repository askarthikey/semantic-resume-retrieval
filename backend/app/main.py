import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

from app.config import get_settings
from app.repositories.faiss_repository import EnsembleFaissRepository
from app.repositories.identity_repository import MongoIdentityRepository
from app.repositories.mongo_repository import MongoUploadJobRepository
from app.repositories.mongo_repository import MongoResumeRepository
from app.repositories.supabase_storage_repository import SupabaseStorageRepository
from app.routers.auth import router as auth_router
from app.routers.resumes import router as resumes_router
from app.routers.workspaces import router as workspaces_router
from app.services.embedding_service import EnsembleEmbeddingService
from app.state.container import AppContainer


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    settings = get_settings()
    mongo_client = MongoClient(settings.mongo_uri)
    database = mongo_client[settings.mongo_db_name]
    collection = database["resumes"]
    upload_jobs_collection = database["upload_jobs"]
    users_collection = database["users"]
    workspaces_collection = database["workspaces"]
    memberships_collection = database["workspace_memberships"]

    identity_repository = MongoIdentityRepository(
        users_collection=users_collection,
        workspaces_collection=workspaces_collection,
        memberships_collection=memberships_collection,
    )
    identity_repository.ensure_indexes()

    # ── Ensemble embedding service ────────────────────────────────────
    model_names = settings.ensemble_models_list
    embedding_service = EnsembleEmbeddingService(model_names)

    model_dimensions: dict[str, int] = {
        info.slug: info.dimension for info in embedding_service.get_models()
    }

    faiss_store_dir = str(settings.faiss_index_path).rsplit("/", 1)[0]  # e.g. ./faiss_store

    faiss_repository = EnsembleFaissRepository(
        store_dir=faiss_store_dir,
        model_dimensions=model_dimensions,
    )

    container = AppContainer(
        mongo_client=mongo_client,
        mongo_repository=MongoResumeRepository(collection),
        upload_job_repository=MongoUploadJobRepository(upload_jobs_collection),
        identity_repository=identity_repository,
        faiss_repository=faiss_repository,
        storage_repository=SupabaseStorageRepository(
            url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
            bucket=settings.supabase_bucket,
            path_prefix=settings.supabase_path_prefix,
            signed_url_ttl_seconds=settings.supabase_signed_url_ttl_seconds,
        ),
        embedding_service=embedding_service,
        write_lock=asyncio.Lock(),
        ensemble_fusion_k=settings.ensemble_fusion_k,
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
app.include_router(auth_router)
app.include_router(workspaces_router)


@app.get("/health")
def health() -> dict[str, str | int]:
    return {
        "status": "ok",
        "service": "semantic-resume-retrieval",
        "version": 1,
    }
