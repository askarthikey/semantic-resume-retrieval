from datetime import datetime

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


class UserProfile(BaseModel):
    user_id: str
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile


class TokenPayload(BaseModel):
    sub: str
    email: str
    exp: int
    iat: int
