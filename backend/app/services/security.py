import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings
from app.models.auth import TokenPayload


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 390000)
    return f"pbkdf2_sha256${base64.b64encode(salt).decode('ascii')}${base64.b64encode(digest).decode('ascii')}"


def verify_password(password: str, encoded_password: str) -> bool:
    try:
        scheme, salt_b64, digest_b64 = encoded_password.split("$", 2)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected_digest = base64.b64decode(digest_b64)
    except Exception:
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 390000)
    return hmac.compare_digest(candidate, expected_digest)


def create_access_token(user_id: str, email: str) -> tuple[str, int]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires_in = settings.jwt_expiration_seconds
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> TokenPayload:
    settings = get_settings()
    decoded = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    return TokenPayload(**decoded)
