import os

import fitz
from fastapi import UploadFile


def extract_text_from_bytes(filename: str, file_bytes: bytes) -> str:
    extension = os.path.splitext((filename or "").lower())[1]

    if extension == ".txt":
        return file_bytes.decode("utf-8", errors="ignore")

    if extension == ".pdf":
        document = fitz.open(stream=file_bytes, filetype="pdf")
        try:
            return "\n".join(page.get_text("text") for page in document)
        finally:
            document.close()

    raise ValueError("Unsupported file format")


async def extract_text_from_upload(file: UploadFile) -> str:
    filename = file.filename or ""
    file_bytes = await file.read()
    return extract_text_from_bytes(filename, file_bytes)
