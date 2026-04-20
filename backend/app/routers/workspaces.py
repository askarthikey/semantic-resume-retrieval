from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.auth import UserProfile
from app.models.workspace import WorkspaceCreateRequest, WorkspaceResponse
from app.state.container import AppContainer

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def get_container() -> AppContainer:
    from app.main import app

    return app.state.container


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(
    user: UserProfile = Depends(get_current_user),
    container: AppContainer = Depends(get_container),
) -> list[WorkspaceResponse]:
    docs = container.identity_repository.list_user_workspaces(user.user_id)
    return [
        WorkspaceResponse(
            workspace_id=str(doc["_id"]),
            name=doc.get("name", "Untitled Workspace"),
            created_at=doc["created_at"],
        )
        for doc in docs
    ]


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreateRequest,
    user: UserProfile = Depends(get_current_user),
    container: AppContainer = Depends(get_container),
) -> WorkspaceResponse:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace name is required")

    doc = container.identity_repository.create_workspace(name=name, owner_user_id=user.user_id)
    return WorkspaceResponse(
        workspace_id=str(doc["_id"]),
        name=doc["name"],
        created_at=doc["created_at"],
    )
