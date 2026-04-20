from datetime import datetime

from pydantic import BaseModel, Field


class UploadItem(BaseModel):
    mongo_id: str
    filename: str
    candidate_name: str
    upload_timestamp: datetime


class UploadFailure(BaseModel):
    filename: str
    error: str


class UploadResponse(BaseModel):
    success: bool
    uploaded: list[UploadItem] = Field(default_factory=list)
    failed: list[UploadFailure] = Field(default_factory=list)


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


class DeleteResponse(BaseModel):
    success: bool
    message: str
