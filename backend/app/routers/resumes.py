import math

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.models.api import (
    DeleteResponse,
    ResumeDetailResponse,
    ResumeListItem,
    ResumeListResponse,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    UploadFailure,
    UploadItem,
    UploadResponse,
)
from app.services.file_parsing import extract_text_from_upload
from app.services.text_processing import allowed_extension, clean_text, extract_candidate_name
from app.state.container import AppContainer

router = APIRouter(prefix="/resumes", tags=["resumes"])


def get_container() -> AppContainer:
    from app.main import app

    return app.state.container


@router.post("/upload", response_model=UploadResponse)
async def upload_resumes(
    files: list[UploadFile] = File(...),
    container: AppContainer = Depends(get_container),
) -> UploadResponse:
    uploaded: list[UploadItem] = []
    failed: list[UploadFailure] = []

    for file in files:
        filename = file.filename or "unknown_file"
        if not allowed_extension(filename):
            failed.append(UploadFailure(filename=filename, error="Only .pdf and .txt files are supported"))
            continue

        try:
            raw_text = await extract_text_from_upload(file)
            cleaned_text = clean_text(raw_text)
            if not cleaned_text:
                failed.append(UploadFailure(filename=filename, error="No extractable text found in file"))
                continue
            candidate_name = extract_candidate_name(cleaned_text, filename)
            vector = container.embedding_service.embed_text(cleaned_text)

            async with container.write_lock:
                mongo_id = container.mongo_repository.create_resume(
                    filename=filename,
                    candidate_name=candidate_name,
                    raw_text=cleaned_text,
                )
                container.faiss_repository.add(vector, mongo_id)

            doc = container.mongo_repository.get_resume(mongo_id)
            if not doc:
                raise HTTPException(status_code=500, detail="Resume was stored but could not be retrieved")

            uploaded.append(
                UploadItem(
                    mongo_id=mongo_id,
                    filename=doc["filename"],
                    candidate_name=doc["candidate_name"],
                    upload_timestamp=doc["upload_timestamp"],
                )
            )
        except HTTPException:
            raise
        except Exception as exc:
            failed.append(UploadFailure(filename=filename, error=str(exc)))

    return UploadResponse(success=len(failed) == 0, uploaded=uploaded, failed=failed)


@router.post("/search", response_model=SearchResponse)
def search_resumes(
    payload: SearchRequest,
    container: AppContainer = Depends(get_container),
) -> SearchResponse:
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query must not be empty")

    if container.faiss_repository.index.ntotal == 0:
        return SearchResponse(query=query, results=[], total=0, message="No resumes indexed yet")

    query_vec = container.embedding_service.embed_text(query)
    distances, ids = container.faiss_repository.search(query_vec, payload.top_k)

    ranked_candidates: list[tuple[int, float, str]] = []
    for score, faiss_id in zip(distances[0], ids[0]):
        if faiss_id < 0:
            continue
        if faiss_id >= len(container.faiss_repository.id_map):
            continue
        mongo_id = container.faiss_repository.id_map[faiss_id]
        ranked_candidates.append((int(faiss_id), float(score), mongo_id))

    docs_map = container.mongo_repository.get_resumes_by_ids([item[2] for item in ranked_candidates])

    results: list[SearchResultItem] = []
    rank = 1
    for _, score, mongo_id in ranked_candidates:
        doc = docs_map.get(mongo_id)
        if not doc:
            continue

        snippet = (doc.get("raw_text") or "")[:300]
        similarity = max(0.0, min(1.0, (score + 1.0) / 2.0))

        results.append(
            SearchResultItem(
                rank=rank,
                mongo_id=mongo_id,
                candidate_name=doc.get("candidate_name", "Unknown"),
                filename=doc.get("filename", "Unknown"),
                similarity_score=similarity,
                snippet=snippet,
            )
        )
        rank += 1

    return SearchResponse(query=query, results=results, total=len(results))


@router.get("", response_model=ResumeListResponse)
def list_resumes(
    page: int = 1,
    page_size: int = 20,
    container: AppContainer = Depends(get_container),
) -> ResumeListResponse:
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Invalid pagination parameters")

    docs, total = container.mongo_repository.list_resumes(page=page, page_size=page_size)
    total_pages = max(1, math.ceil(total / page_size))

    items = [
        ResumeListItem(
            mongo_id=str(doc["_id"]),
            filename=doc["filename"],
            candidate_name=doc["candidate_name"],
            upload_timestamp=doc["upload_timestamp"],
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
    container: AppContainer = Depends(get_container),
) -> ResumeDetailResponse:
    doc = container.mongo_repository.get_resume(resume_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")

    return ResumeDetailResponse(
        mongo_id=str(doc["_id"]),
        filename=doc["filename"],
        candidate_name=doc["candidate_name"],
        raw_text=doc["raw_text"],
        upload_timestamp=doc["upload_timestamp"],
    )


@router.delete("/{resume_id}", response_model=DeleteResponse)
def delete_resume(
    resume_id: str,
    container: AppContainer = Depends(get_container),
) -> DeleteResponse:
    deleted = container.mongo_repository.soft_delete_resume(resume_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Resume not found")
    return DeleteResponse(success=True, message="Resume deleted successfully")
