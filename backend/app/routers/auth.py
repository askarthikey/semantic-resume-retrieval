from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.auth import AuthResponse, LoginRequest, RegisterRequest, UserProfile
from app.services.security import create_access_token, hash_password, verify_password
from app.state.container import AppContainer

router = APIRouter(prefix="/auth", tags=["auth"])


def get_container() -> AppContainer:
    from app.main import app

    return app.state.container


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, container: AppContainer = Depends(get_container)) -> AuthResponse:
    existing = container.identity_repository.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    try:
        user_doc = container.identity_repository.create_user(
            email=payload.email,
            password_hash=hash_password(payload.password),
        )
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from exc

    token, expires_in = create_access_token(str(user_doc["_id"]), user_doc["email"])
    return AuthResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserProfile(
            user_id=str(user_doc["_id"]),
            email=user_doc["email"],
            created_at=user_doc["created_at"],
        ),
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, container: AppContainer = Depends(get_container)) -> AuthResponse:
    user_doc = container.identity_repository.get_user_by_email(payload.email)
    if not user_doc or not verify_password(payload.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token, expires_in = create_access_token(str(user_doc["_id"]), user_doc["email"])
    return AuthResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserProfile(
            user_id=str(user_doc["_id"]),
            email=user_doc["email"],
            created_at=user_doc["created_at"],
        ),
    )


@router.get("/me", response_model=UserProfile)
def me(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return user
