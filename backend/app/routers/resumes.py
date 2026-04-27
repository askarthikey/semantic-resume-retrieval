import math
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from app.auth.dependencies import get_current_user, get_current_workspace_id
from app.models.auth import UserProfile
from app.models.api import (
    DeleteResponse,
    ResumeFileStorageInfo,
    ResumeDetailResponse,
    ResumeListItem,
    ResumeListResponse,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    UploadJobAcceptedResponse,
    UploadJobFileStatus,
    UploadJobStatusResponse,
    UploadFailure,
    UploadItem,
    UploadResponse,
)
from app.services.file_parsing import extract_text_from_bytes
from app.services.score_fusion import reciprocal_rank_fusion
from app.services.text_processing import allowed_extension, clean_text, extract_candidate_name
from app.state.container import AppContainer

router = APIRouter(prefix="/resumes", tags=["resumes"])


def get_container() -> AppContainer:
    from app.main import app

    return app.state.container


def build_storage_info(container: AppContainer, doc: dict | None) -> ResumeFileStorageInfo | None:
    if not doc:
        return None

    bucket = doc.get("storage_bucket")
    object_key = doc.get("storage_object_key")
    mime_type = doc.get("storage_mime_type")
    size_bytes = doc.get("storage_size_bytes")
    if not all([bucket, object_key, mime_type]) or size_bytes is None:
        return None

    download_url: str | None = None
    try:
        download_url = container.storage_repository.create_signed_url(object_key)
    except Exception:
        download_url = None

    return ResumeFileStorageInfo(
        bucket=bucket,
        object_key=object_key,
        mime_type=mime_type,
        size_bytes=size_bytes,
        download_url=download_url,
    )


def serialize_job_status(job_id: str, doc: dict) -> UploadJobStatusResponse:
    files = [
        UploadJobFileStatus(
            file_id=item.get("file_id", ""),
            filename=item.get("filename", "unknown_file"),
            status=item.get("status", "pending"),
            error=item.get("error"),
            mongo_id=item.get("mongo_id"),
            candidate_name=item.get("candidate_name"),
        )
        for item in doc.get("files", [])
    ]

    return UploadJobStatusResponse(
        job_id=job_id,
        status=doc.get("status", "queued"),
        total_files=int(doc.get("total_files", len(files))),
        processed_files=int(doc.get("processed_files", 0)),
        success_count=int(doc.get("success_count", 0)),
        failure_count=int(doc.get("failure_count", 0)),
        files=files,
        created_at=doc["created_at"],
        started_at=doc.get("started_at"),
        completed_at=doc.get("completed_at"),
    )


async def process_upload_job(container: AppContainer, job_id: str) -> None:
    repo = container.upload_job_repository
    if not ObjectId.is_valid(job_id):
        return

    job_doc = container.upload_job_repository.collection.find_one({"_id": ObjectId(job_id)})
    if not job_doc:
        return

    workspace_id = job_doc.get("workspace_id")
    if not workspace_id:
        return

    job_doc = repo.get_job(job_id, workspace_id)
    if not job_doc:
        return

    pending_files = [item for item in job_doc.get("files", []) if item.get("status") == "pending"]
    if not pending_files:
        repo.finalize_job(job_id, workspace_id)
        return

    repo.mark_started(job_id, workspace_id)
    for file_info in pending_files:
        file_id = file_info.get("file_id")
        filename = file_info.get("filename") or "unknown_file"
        object_key = file_info.get("storage_object_key")
        if not file_id or not object_key:
            if file_id:
                repo.mark_file_error(job_id, file_id, "Storage metadata missing", workspace_id)
            continue

        repo.mark_file_processing(job_id, file_id, workspace_id)
        mongo_id: str | None = None
        try:
            file_bytes = container.storage_repository.download_object(object_key)
            raw_text = extract_text_from_bytes(filename, file_bytes)
            cleaned_text = clean_text(raw_text)
            if not cleaned_text:
                raise ValueError("No extractable text found in file")

            candidate_name = extract_candidate_name(cleaned_text, filename)

            # ── Ensemble: embed with all models ───────────────────────
            vectors = container.embedding_service.embed_text(cleaned_text)

            async with container.write_lock:
                mongo_id = container.mongo_repository.create_resume(
                    workspace_id=workspace_id,
                    filename=filename,
                    candidate_name=candidate_name,
                    raw_text=cleaned_text,
                    storage_bucket=file_info.get("storage_bucket"),
                    storage_object_key=object_key,
                    storage_mime_type=file_info.get("storage_mime_type"),
                    storage_size_bytes=file_info.get("storage_size_bytes"),
                )
                # Add vectors for every model into the ensemble FAISS repo
                container.faiss_repository.add(vectors, mongo_id)

            repo.mark_file_success(job_id, file_id, mongo_id, candidate_name, workspace_id)
        except Exception as exc:
            if mongo_id:
                container.mongo_repository.soft_delete_resume(mongo_id, workspace_id)
            try:
                container.storage_repository.delete_object(object_key)
            except Exception:
                pass
            repo.mark_file_error(job_id, file_id, str(exc), workspace_id)

    repo.finalize_job(job_id, workspace_id)


@router.post("/upload", response_model=UploadJobAcceptedResponse, status_code=202)
async def upload_resumes(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    _user: UserProfile = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id),
    container: AppContainer = Depends(get_container),
) -> UploadJobAcceptedResponse:
    job_files: list[dict] = []

    for file in files:
        filename = file.filename or "unknown_file"
        file_id = uuid4().hex

        if not allowed_extension(filename):
            job_files.append(
                {
                    "file_id": file_id,
                    "filename": filename,
                    "status": "error",
                    "error": "Only .pdf and .txt files are supported",
                    "mongo_id": None,
                    "candidate_name": None,
                }
            )
            continue

        try:
            file_bytes = await file.read()
            storage_meta = container.storage_repository.upload_resume(
                filename=filename,
                content=file_bytes,
                content_type=file.content_type,
                workspace_id=workspace_id,
            )
            job_files.append(
                {
                    "file_id": file_id,
                    "filename": filename,
                    "status": "pending",
                    "error": None,
                    "mongo_id": None,
                    "candidate_name": None,
                    "storage_bucket": storage_meta["bucket"],
                    "storage_object_key": storage_meta["object_key"],
                    "storage_mime_type": storage_meta["mime_type"],
                    "storage_size_bytes": storage_meta["size_bytes"],
                }
            )
        except Exception as exc:
            job_files.append(
                {
                    "file_id": file_id,
                    "filename": filename,
                    "status": "error",
                    "error": str(exc),
                    "mongo_id": None,
                    "candidate_name": None,
                }
            )

    job_id = container.upload_job_repository.create_job(job_files, workspace_id)
    if any(item.get("status") == "pending" for item in job_files):
        background_tasks.add_task(process_upload_job, container, job_id)

    job_doc = container.upload_job_repository.get_job(job_id, workspace_id)
    current_status = "queued"
    if job_doc:
        current_status = str(job_doc.get("status", "queued"))

    return UploadJobAcceptedResponse(
        job_id=job_id,
        status=current_status,
        total_files=len(job_files),
        message="Files uploaded to cloud storage. Resume processing is running in the background.",
    )


@router.get("/upload-jobs/{job_id}", response_model=UploadJobStatusResponse)
def get_upload_job_status(
    job_id: str,
    _user: UserProfile = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id),
    container: AppContainer = Depends(get_container),
) -> UploadJobStatusResponse:
    doc = container.upload_job_repository.get_job(job_id, workspace_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Upload job not found")
    return serialize_job_status(job_id, doc)


@router.post("/search", response_model=SearchResponse)
def search_resumes(
    payload: SearchRequest,
    _user: UserProfile = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id),
    container: AppContainer = Depends(get_container),
) -> SearchResponse:
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query must not be empty")

    if container.faiss_repository.is_empty():
        return SearchResponse(query=query, results=[], total=0, message="No resumes indexed yet")

    # ── Ensemble search ───────────────────────────────────────────────
    # 1. Embed query with every model
    query_vectors = container.embedding_service.embed_text(query)

    # 2. Search each per-model FAISS index
    per_model_rankings = container.faiss_repository.search(query_vectors, payload.top_k)

    # 3. Fuse rankings via Reciprocal Rank Fusion
    fused = reciprocal_rank_fusion(per_model_rankings, k=container.ensemble_fusion_k)

    # 4. Trim to top_k
    fused = fused[: payload.top_k]

    # 5. Hydrate from MongoDB
    mongo_ids = [mid for mid, _, _ in fused]
    docs_map = container.mongo_repository.get_resumes_by_ids(mongo_ids, workspace_id)

    # 6. Build results and compute absolute similarity scores
    results: list[SearchResultItem] = []
    rank = 1
    for mongo_id, rrf_score, raw_scores in fused:
        doc = docs_map.get(mongo_id)
        if not doc:
            continue

        snippet = (doc.get("raw_text") or "")[:300]

        # Convert raw cosine scores to 0..1 for per-model display
        # Clamp negative similarities to 0 to accurately reflect unrelated documents
        per_model_display = {
            slug: max(0.0, min(1.0, float(s)))
            for slug, s in raw_scores.items()
        }

        # Overall similarity is the average absolute similarity across all models
        if per_model_display:
            similarity = sum(per_model_display.values()) / len(per_model_display)
        else:
            similarity = 0.0

        results.append(
            SearchResultItem(
                rank=rank,
                mongo_id=mongo_id,
                candidate_name=doc.get("candidate_name", "Unknown"),
                filename=doc.get("filename", "Unknown"),
                similarity_score=similarity,
                snippet=snippet,
                per_model_scores=per_model_display,
            )
        )
        rank += 1

    return SearchResponse(query=query, results=results, total=len(results))


@router.get("", response_model=ResumeListResponse)
def list_resumes(
    page: int = 1,
    page_size: int = 20,
    _user: UserProfile = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id),
    container: AppContainer = Depends(get_container),
) -> ResumeListResponse:
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Invalid pagination parameters")

    docs, total = container.mongo_repository.list_resumes(page=page, page_size=page_size, workspace_id=workspace_id)
    total_pages = max(1, math.ceil(total / page_size))

    items = [
        ResumeListItem(
            mongo_id=str(doc["_id"]),
            filename=doc["filename"],
            candidate_name=doc["candidate_name"],
            upload_timestamp=doc["upload_timestamp"],
            file_storage=build_storage_info(container, doc),
        )
        for doc in docs
    ]

    return ResumeListResponse(
        resumes=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/{resume_id}", response_model=ResumeDetailResponse)
def get_resume(
    resume_id: str,
    _user: UserProfile = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id),
    container: AppContainer = Depends(get_container),
) -> ResumeDetailResponse:
    doc = container.mongo_repository.get_resume(resume_id, workspace_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")

    return ResumeDetailResponse(
        mongo_id=str(doc["_id"]),
        filename=doc["filename"],
        candidate_name=doc["candidate_name"],
        raw_text=doc["raw_text"],
        upload_timestamp=doc["upload_timestamp"],
        file_storage=build_storage_info(container, doc),
    )


@router.delete("/{resume_id}", response_model=DeleteResponse)
def delete_resume(
    resume_id: str,
    _user: UserProfile = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id),
    container: AppContainer = Depends(get_container),
) -> DeleteResponse:
    doc = container.mongo_repository.get_resume(resume_id, workspace_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")

    object_key = doc.get("storage_object_key")
    if object_key:
        try:
            container.storage_repository.delete_object(object_key)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to delete file from storage: {exc}") from exc

    deleted = container.mongo_repository.soft_delete_resume(resume_id, workspace_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Resume not found")
    return DeleteResponse(success=True, message="Resume deleted successfully")
