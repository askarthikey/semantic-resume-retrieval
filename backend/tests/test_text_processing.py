from app.services.text_processing import clean_text, extract_candidate_name


def test_clean_text_removes_extra_whitespace() -> None:
    dirty = "Alice\x00\n\n\n  Engineer\t\tPython"
    cleaned = clean_text(dirty)
    assert cleaned == "Alice\n\n Engineer Python"


def test_extract_candidate_name_uses_first_valid_line() -> None:
    text = "John Doe\njohn@example.com\nSenior Developer"
    assert extract_candidate_name(text, "resume.pdf") == "John Doe"


def test_extract_candidate_name_fallback() -> None:
    text = "john@example.com\n+1-555-1234"
    assert extract_candidate_name(text, "jane-doe_cv.pdf") == "jane doe cv"
