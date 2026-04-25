"""Tests for Reciprocal Rank Fusion score fusion."""

from app.services.score_fusion import reciprocal_rank_fusion


def test_rrf_basic_two_models():
    """Two models with overlapping candidates produce correct fused ordering."""
    per_model = {
        "model_a": [("doc1", 0.9), ("doc2", 0.8), ("doc3", 0.7)],
        "model_b": [("doc2", 0.95), ("doc1", 0.85), ("doc3", 0.6)],
    }
    fused = reciprocal_rank_fusion(per_model, k=60)

    ids = [mid for mid, _, _ in fused]
    # doc1: 1/(60+1) + 1/(60+2) = ~0.01639 + 0.01613 = 0.03252
    # doc2: 1/(60+2) + 1/(60+1) = ~0.01613 + 0.01639 = 0.03252
    # doc3: 1/(60+3) + 1/(60+3) = ~0.01587 + 0.01587 = 0.03175
    # doc1 and doc2 tie on score, so sorted by id: doc1, doc2
    assert ids == ["doc1", "doc2", "doc3"]


def test_rrf_single_model():
    """Single model should preserve original rank ordering."""
    per_model = {
        "only_model": [("a", 0.5), ("b", 0.3), ("c", 0.1)],
    }
    fused = reciprocal_rank_fusion(per_model, k=60)
    ids = [mid for mid, _, _ in fused]
    assert ids == ["a", "b", "c"]


def test_rrf_disjoint_models():
    """Models with completely different candidates merge all of them."""
    per_model = {
        "m1": [("x", 0.9)],
        "m2": [("y", 0.8)],
    }
    fused = reciprocal_rank_fusion(per_model, k=60)
    ids = set(mid for mid, _, _ in fused)
    assert ids == {"x", "y"}


def test_rrf_empty():
    """No rankings should produce empty result."""
    fused = reciprocal_rank_fusion({}, k=60)
    assert fused == []


def test_rrf_per_model_raw_scores():
    """Fused results carry per-model raw score maps."""
    per_model = {
        "ma": [("d1", 0.9), ("d2", 0.5)],
        "mb": [("d1", 0.7)],
    }
    fused = reciprocal_rank_fusion(per_model, k=60)
    d1_entry = next(entry for entry in fused if entry[0] == "d1")
    raw = d1_entry[2]
    assert raw["ma"] == 0.9
    assert raw["mb"] == 0.7

    d2_entry = next(entry for entry in fused if entry[0] == "d2")
    assert "ma" in d2_entry[2]
    assert "mb" not in d2_entry[2]
