"""Reciprocal Rank Fusion (RRF) for combining per-model retrieval rankings.

Reference: Cormack, Clarke & Buettcher (2009).
    RRF_score(d) = Σ_{m ∈ models}  1 / (k + rank_m(d))
"""

from __future__ import annotations


def reciprocal_rank_fusion(
    per_model_rankings: dict[str, list[tuple[str, float]]],
    k: int = 60,
) -> list[tuple[str, float, dict[str, float]]]:
    """Fuse per-model ranked lists into a single ranking via RRF.

    Parameters
    ----------
    per_model_rankings : dict[str, list[tuple[str, float]]]
        ``{model_slug: [(mongo_id, raw_score), ...]}`` – each list is ordered
        by descending relevance (rank 1 = best).
    k : int
        RRF constant; higher k dampens the influence of high ranks.

    Returns
    -------
    list[tuple[str, float, dict[str, float]]]
        ``[(mongo_id, fused_rrf_score, {slug: raw_score, ...}), ...]``
        sorted by *descending* fused score.
    """
    rrf_scores: dict[str, float] = {}
    raw_scores: dict[str, dict[str, float]] = {}

    for slug, ranked_list in per_model_rankings.items():
        for rank_idx, (mongo_id, raw_score) in enumerate(ranked_list):
            rank = rank_idx + 1  # 1-indexed
            rrf_scores[mongo_id] = rrf_scores.get(mongo_id, 0.0) + 1.0 / (k + rank)
            raw_scores.setdefault(mongo_id, {})[slug] = raw_score

    # Sort by descending RRF score, then by mongo_id for determinism
    fused = sorted(
        [(mid, score, raw_scores.get(mid, {})) for mid, score in rrf_scores.items()],
        key=lambda t: (-t[1], t[0]),
    )
    return fused
