import mimetypes
import re
from datetime import datetime, timezone
from uuid import uuid4

from supabase import Client, create_client


class SupabaseStorageRepository:
    def __init__(
        self,
        url: str,
        service_role_key: str,
        bucket: str,
        path_prefix: str = "resumes",
        signed_url_ttl_seconds: int = 3600,
    ):
        if not url or not service_role_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")

        self.bucket = bucket
        self.path_prefix = (path_prefix or "resumes").strip("/")
        self.signed_url_ttl_seconds = max(60, int(signed_url_ttl_seconds))
        self.client: Client = create_client(url, service_role_key)

    def upload_resume(
        self,
        filename: str,
        content: bytes,
        content_type: str | None = None,
        workspace_id: str | None = None,
    ) -> dict[str, str | int]:
        if not content:
            raise ValueError("Uploaded file is empty")

        safe_name = self._sanitize_filename(filename)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        workspace_prefix = f"/{workspace_id.strip('/')}" if workspace_id else ""
        object_key = f"{self.path_prefix}{workspace_prefix}/{timestamp}-{uuid4().hex}-{safe_name}"
        mime_type = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"

        self.client.storage.from_(self.bucket).upload(
            path=object_key,
            file=content,
            file_options={"content-type": mime_type, "upsert": "false"},
        )

        return {
            "bucket": self.bucket,
            "object_key": object_key,
            "mime_type": mime_type,
            "size_bytes": len(content),
        }

    def create_signed_url(self, object_key: str, expires_in: int | None = None) -> str:
        ttl = max(60, int(expires_in or self.signed_url_ttl_seconds))
        payload = self.client.storage.from_(self.bucket).create_signed_url(object_key, ttl)
        signed_url = payload.get("signedURL") or payload.get("signedUrl")
        if not signed_url:
            raise RuntimeError("Supabase signed URL was not returned")
        return signed_url

    def delete_object(self, object_key: str) -> None:
        if not object_key:
            return
        self.client.storage.from_(self.bucket).remove([object_key])

    def download_object(self, object_key: str) -> bytes:
        if not object_key:
            raise ValueError("Object key must not be empty")
        content = self.client.storage.from_(self.bucket).download(object_key)
        if not content:
            raise RuntimeError("Supabase storage download returned empty content")
        return bytes(content)

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "unknown_file")
        return cleaned.strip("._") or "unknown_file"