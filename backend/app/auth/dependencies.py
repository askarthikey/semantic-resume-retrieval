from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

from app.models.auth import UserProfile
from app.state.container import AppContainer


bearer_scheme = HTTPBearer(auto_error=True)


def get_container() -> AppContainer:
    from app.main import app

    return app.state.container


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserProfile:
    from app.services.security import decode_access_token

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    container = get_container()
    user_doc = container.identity_repository.get_user_by_id(payload.sub)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return UserProfile(
        user_id=str(user_doc["_id"]),
        email=user_doc["email"],
        created_at=user_doc["created_at"],
    )


def get_current_workspace_id(
    user: UserProfile = Depends(get_current_user),
    x_workspace_id: str | None = Header(default=None, alias="X-Workspace-Id"),
) -> str:
    if not x_workspace_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Workspace-Id header is required")

    container = get_container()
    if not container.identity_repository.is_member(user.user_id, x_workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workspace access denied")

    workspace = container.identity_repository.get_workspace(x_workspace_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return x_workspace_id
