from datetime import datetime

from pydantic import BaseModel, Field


class ResumeFileStorageInfo(BaseModel):
    bucket: str
    object_key: str
    mime_type: str
    size_bytes: int
    download_url: str | None = None


class UploadItem(BaseModel):
    mongo_id: str
    filename: str
    candidate_name: str
    upload_timestamp: datetime
    file_storage: ResumeFileStorageInfo | None = None


class UploadFailure(BaseModel):
    filename: str
    error: str


class UploadResponse(BaseModel):
    success: bool
    uploaded: list[UploadItem] = Field(default_factory=list)
    failed: list[UploadFailure] = Field(default_factory=list)


class UploadJobAcceptedResponse(BaseModel):
    job_id: str
    status: str
    total_files: int
    message: str


class UploadJobFileStatus(BaseModel):
    file_id: str
    filename: str
    status: str
    error: str | None = None
    mongo_id: str | None = None
    candidate_name: str | None = None


class UploadJobStatusResponse(BaseModel):
    job_id: str
    status: str
    total_files: int
    processed_files: int
    success_count: int
    failure_count: int
    files: list[UploadJobFileStatus] = Field(default_factory=list)
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=10, ge=1, le=50)


class SearchResultItem(BaseModel):
    rank: int
    mongo_id: str
    candidate_name: str
    filename: str
    similarity_score: float
    snippet: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int
    message: str | None = None


class ResumeListItem(BaseModel):
    mongo_id: str
    filename: str
    candidate_name: str
    upload_timestamp: datetime
    file_storage: ResumeFileStorageInfo | None = None


class ResumeListResponse(BaseModel):
    resumes: list[ResumeListItem]
    page: int
    page_size: int
    total: int
    total_pages: int


class ResumeDetailResponse(BaseModel):
    mongo_id: str
    filename: str
    candidate_name: str
    raw_text: str
    upload_timestamp: datetime
    file_storage: ResumeFileStorageInfo | None = None


class DeleteResponse(BaseModel):
    success: bool
    message: str
