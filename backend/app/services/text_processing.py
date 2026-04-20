import os
import re
from pathlib import Path


def clean_text(raw_text: str) -> str:
    if not raw_text:
        return ""

    text = raw_text.replace("\x00", " ")
    text = text.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ ]+\n", "\n", text)
    text = re.sub(r"[\t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def extract_candidate_name(cleaned_text: str, filename: str) -> str:
    fallback = Path(filename).stem.replace("_", " ").replace("-", " ").strip() or "Unknown Candidate"
    if not cleaned_text:
        return fallback

    lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
    for line in lines[:8]:
        lower_line = line.lower()
        if "@" in line or "http" in lower_line or re.search(r"\d", line):
            continue
        words = [part for part in re.split(r"\s+", line) if part]
        if 1 < len(words) <= 4 and all(re.match(r"^[A-Za-z][A-Za-z'.-]*$", w) for w in words):
            return " ".join(word.capitalize() for word in words)
    return fallback


def allowed_extension(filename: str) -> bool:
    ext = os.path.splitext(filename.lower())[1]
    return ext in {".pdf", ".txt"}
