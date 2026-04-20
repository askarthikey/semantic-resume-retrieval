from datetime import datetime

from pydantic import BaseModel, Field


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class WorkspaceResponse(BaseModel):
    workspace_id: str
    name: str
    created_at: datetime
