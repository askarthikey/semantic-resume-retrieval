# Ensemble Models — Semantic Resume Retrieval

## Table of Contents

1. [Overview](#overview)
2. [What is Model Ensembling?](#what-is-model-ensembling)
3. [Why Ensemble for Resume Retrieval?](#why-ensemble-for-resume-retrieval)
4. [Architecture](#architecture)
5. [Ensemble Models Used](#ensemble-models-used)
6. [Score Fusion: Reciprocal Rank Fusion (RRF)](#score-fusion-reciprocal-rank-fusion-rrf)
7. [Implementation Details](#implementation-details)
8. [Configuration](#configuration)
9. [API Changes](#api-changes)
10. [Performance Considerations](#performance-considerations)
11. [Single-Model vs Ensemble Comparison](#single-model-vs-ensemble-comparison)
12. [Data Flow Diagrams](#data-flow-diagrams)
13. [Migration Guide](#migration-guide)

---

## Overview

This document describes the **ensemble embedding model** system integrated into the Semantic Resume Retrieval backend. Instead of relying on a single sentence-transformer model for embedding and searching resumes, the system now runs **multiple models in parallel** and fuses their retrieval results using **Reciprocal Rank Fusion (RRF)** — a late-fusion strategy that produces more robust and accurate search rankings.

---

## What is Model Ensembling?

Model ensembling is a machine learning technique where multiple models are combined to produce a result that is better than any single model alone. The core insight is that **different models have different strengths and weaknesses**, and combining them reduces individual model biases.

There are two broad categories:

| Strategy | Description | When to Use |
|---|---|---|
| **Early Fusion** | Combine model outputs (e.g., concatenate embeddings) before the ranking step | When you want a single unified representation |
| **Late Fusion** ✅ | Each model independently retrieves & ranks, then results are merged | When models produce different-dimensional outputs or different score distributions |

We use **late fusion** because:
- Our models produce vectors of different dimensions (384, 768)
- Each model's cosine similarity scores are on incomparable scales
- Late fusion is simpler, more modular, and easier to extend

---

## Why Ensemble for Resume Retrieval?

Resume search is inherently challenging because:

1. **Vocabulary mismatch**: A recruiter searching for "Python developer" should also find resumes mentioning "software engineer with Python experience". Different models capture different aspects of semantic similarity.

2. **Query type diversity**: Some searches are question-like ("Who has experience with distributed systems?") while others are keyword-like ("React TypeScript senior"). Models trained on different objectives handle these differently.

3. **Document structure**: Resumes have unique structures — headers, bullet points, mixed technical and natural language. No single model is optimal for all of these.

4. **Robustness**: If one model performs poorly on a particular query, the others compensate.

---

## Architecture

```
                        ┌──────────────────────┐
                        │    Search Query       │
                        │  "ML engineer with    │
                        │   Python experience"  │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
           │ all-MiniLM   │ │ all-mpnet    │ │ multi-qa-MiniLM      │
           │  -L6-v2      │ │  -base-v2    │ │  -L6-cos-v1          │
           │  (384-dim)   │ │  (768-dim)   │ │  (384-dim)           │
           └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘
                  │                │                     │
                  ▼                ▼                     ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
           │ FAISS Index  │ │ FAISS Index  │ │ FAISS Index          │
           │  (384-dim)   │ │  (768-dim)   │ │  (384-dim)           │
           └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘
                  │                │                     │
                  │    Ranked      │    Ranked           │    Ranked
                  │    List #1     │    List #2          │    List #3
                  └────────┬───────┴──────────┬──────────┘
                           │                  │
                           ▼                  │
                  ┌────────────────────────────┘
                  │
                  ▼
           ┌──────────────────────┐
           │  Reciprocal Rank     │
           │  Fusion (RRF)        │
           │                      │
           │  score(d) = Σ 1/(k+r)│
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  Final Ranked List   │
           │  with Fused Scores   │
           └──────────────────────┘
```

---

## Ensemble Models Used

### 1. `all-MiniLM-L6-v2`

| Property | Value |
|---|---|
| **Dimensions** | 384 |
| **Parameters** | ~22M |
| **Max Sequence Length** | 256 tokens |
| **Training Data** | 1B+ sentence pairs |
| **Strengths** | Fast inference, compact, excellent general-purpose semantic similarity |
| **Best For** | Broad keyword and phrase matching |

This is the **fastest** model in the ensemble. It provides a solid baseline for semantic similarity and catches most straightforward matches efficiently.

### 2. `all-mpnet-base-v2`

| Property | Value |
|---|---|
| **Dimensions** | 768 |
| **Parameters** | ~109M |
| **Max Sequence Length** | 384 tokens |
| **Training Data** | 1B+ sentence pairs |
| **Strengths** | Highest quality embeddings, nuanced paraphrase understanding |
| **Best For** | Complex semantic matching, paraphrase detection, longer passages |

This is the **highest-quality** model in the ensemble. It excels at understanding nuanced semantic relationships and paraphrases. While slower, it catches subtle matches that lighter models miss.

### 3. `multi-qa-MiniLM-L6-cos-v1`

| Property | Value |
|---|---|
| **Dimensions** | 384 |
| **Parameters** | ~22M |
| **Max Sequence Length** | 512 tokens |
| **Training Data** | 215M question-answer pairs |
| **Strengths** | Optimised for asymmetric search (short query → long passage) |
| **Best For** | Natural-language questions, query-document matching |

This model is specifically trained for **information retrieval** — matching short questions to longer passages. Since recruiters often phrase searches as questions ("Who has experience with Kubernetes?"), this model excels at that asymmetric matching pattern.

### Why These Three?

```
┌─────────────────────────────────────────────────────────────────┐
│                    Model Coverage Spectrum                       │
│                                                                  │
│  Keyword-like ◄──────────────────────────────────► Question-like │
│  queries                                              queries    │
│                                                                  │
│  ████████████████░░░░░░░░░░░  all-MiniLM-L6-v2                  │
│  ░░░████████████████████████  all-mpnet-base-v2                  │
│  ░░░░░░░░░░░░████████████████ multi-qa-MiniLM-L6-cos-v1         │
│                                                                  │
│  Together: ██████████████████████████████████████████             │
└─────────────────────────────────────────────────────────────────┘
```

The three models are complementary:
- **MiniLM** is fast and covers general similarity
- **MPNet** catches nuanced paraphrases with higher precision
- **Multi-QA** excels at query→document matching

---

## Score Fusion: Reciprocal Rank Fusion (RRF)

### The Problem

Each model produces similarity scores on different scales. Even after L2 normalisation, the score distributions are incomparable:

```
Model A scores:  [0.85, 0.82, 0.79, 0.71, ...]
Model B scores:  [0.43, 0.41, 0.38, 0.35, ...]
```

Simply averaging these would give disproportionate weight to Model A.

### The RRF Solution

Instead of using raw scores, RRF uses only the **rank position** of each document:

```
RRF_score(d) = Σ_{m ∈ models}  1 / (k + rank_m(d))
```

Where:
- `k` is a constant (default: 60) that prevents top-ranked documents from dominating
- `rank_m(d)` is the rank (1-indexed) of document `d` in model `m`'s results

### Worked Example

Suppose we have 3 models and 4 documents:

| Document | Model A Rank | Model B Rank | Model C Rank |
|---|---|---|---|
| Resume-1 | 1 | 3 | 2 |
| Resume-2 | 2 | 1 | 4 |
| Resume-3 | 3 | 2 | 1 |
| Resume-4 | 4 | 4 | 3 |

With k=60:

```
RRF(Resume-1) = 1/(60+1) + 1/(60+3) + 1/(60+2) = 0.01639 + 0.01587 + 0.01613 = 0.04839
RRF(Resume-2) = 1/(60+2) + 1/(60+1) + 1/(60+4) = 0.01613 + 0.01639 + 0.01563 = 0.04815
RRF(Resume-3) = 1/(60+3) + 1/(60+2) + 1/(60+1) = 0.01587 + 0.01613 + 0.01639 = 0.04839
RRF(Resume-4) = 1/(60+4) + 1/(60+4) + 1/(60+3) = 0.01563 + 0.01563 + 0.01587 = 0.04712
```

**Final ranking**: Resume-1 = Resume-3 > Resume-2 > Resume-4

Notice how Resume-3, which was ranked #1 by only one model, ties with Resume-1 because it had consistently good (not exceptional) rankings across all models. This is the power of RRF — it rewards **consensus** across models.

### Why k=60?

The constant `k` controls how much the top positions dominate:

| k value | Effect |
|---|---|
| **k = 1** | Top-ranked documents get huge weight; behaves almost like "winner takes all" |
| **k = 60** ✅ | Balanced; the default from the original RRF paper |
| **k = 1000** | All ranks contribute nearly equally; almost like a vote count |

The default of 60 is well-established in information retrieval research and works robustly across diverse query types.

---

## Implementation Details

### File Structure

```
backend/app/
├── config.py                          # ensemble_models, ensemble_fusion_k
├── main.py                            # Initialises EnsembleEmbeddingService + EnsembleFaissRepository
├── state/
│   └── container.py                   # AppContainer with ensemble types
├── services/
│   ├── embedding_service.py           # EnsembleEmbeddingService (loads N models)
│   ├── score_fusion.py                # reciprocal_rank_fusion() [NEW]
│   ├── file_parsing.py                # (unchanged)
│   └── text_processing.py            # (unchanged)
├── repositories/
│   └── faiss_repository.py            # EnsembleFaissRepository (1 index per model)
├── routers/
│   └── resumes.py                     # Ensemble-aware search + ingestion
└── models/
    └── api.py                         # SearchResultItem with per_model_scores
```

### Key Classes

#### `EnsembleEmbeddingService`

```python
class EnsembleEmbeddingService:
    def __init__(self, model_names: list[str]):
        # Loads all models at startup

    def embed_text(self, text: str) -> dict[str, np.ndarray]:
        # Returns {model_slug: L2-normalised vector}

    def get_models(self) -> list[ModelInfo]:
        # Returns metadata (name, slug, dimension) per model
```

#### `EnsembleFaissRepository`

```python
class EnsembleFaissRepository:
    def __init__(self, store_dir: str, model_dimensions: dict[str, int]):
        # Creates one IndexFlatIP per model

    def add(self, vectors: dict[str, np.ndarray], mongo_id: str):
        # Adds to all sub-indices

    def search(self, query_vectors: dict[str, np.ndarray], top_k: int):
        # Returns {slug: [(mongo_id, score), ...]}
```

#### `reciprocal_rank_fusion()`

```python
def reciprocal_rank_fusion(
    per_model_rankings: dict[str, list[tuple[str, float]]],
    k: int = 60,
) -> list[tuple[str, float, dict[str, float]]]:
    # Returns [(mongo_id, rrf_score, {slug: raw_score})]
```

### FAISS Storage Layout

Before (single model):
```
faiss_store/
├── index.bin
└── id_map.json
```

After (ensemble):
```
faiss_store/
├── index_all_minilm_l6_v2.bin
├── id_map_all_minilm_l6_v2.json
├── index_all_mpnet_base_v2.bin
├── id_map_all_mpnet_base_v2.json
├── index_multi_qa_minilm_l6_cos_v1.bin
└── id_map_multi_qa_minilm_l6_cos_v1.json
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ENSEMBLE_MODELS` | `all-MiniLM-L6-v2,all-mpnet-base-v2,multi-qa-MiniLM-L6-cos-v1` | Comma-separated list of sentence-transformer model names |
| `ENSEMBLE_FUSION_K` | `60` | RRF constant (higher = more uniform weighting) |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Legacy single-model field (kept for backward compatibility) |

### Running with a Single Model

To disable ensembling and use a single model (for testing or resource-constrained environments):

```env
ENSEMBLE_MODELS=all-MiniLM-L6-v2
```

The system degenerates to single-model mode gracefully — RRF with one model preserves the original ranking.

---

## API Changes

### `POST /resumes/search` Response

The `SearchResultItem` now includes an optional `per_model_scores` field:

```json
{
  "query": "machine learning engineer with Python",
  "results": [
    {
      "rank": 1,
      "mongo_id": "6651a7f...",
      "candidate_name": "Jane Doe",
      "filename": "jane_doe_resume.pdf",
      "similarity_score": 1.0,
      "snippet": "Experienced ML engineer...",
      "per_model_scores": {
        "all_minilm_l6_v2": 0.89,
        "all_mpnet_base_v2": 0.92,
        "multi_qa_minilm_l6_cos_v1": 0.87
      }
    }
  ],
  "total": 1
}
```

| Field | Type | Description |
|---|---|---|
| `similarity_score` | `float` | Fused RRF score, normalised to 0..1 (highest result = 1.0) |
| `per_model_scores` | `dict[str, float] \| null` | Per-model cosine similarity scores (0..1), keyed by model slug |

### Backward Compatibility

- `similarity_score` remains the primary score field
- `per_model_scores` is optional and nullable — existing frontends can ignore it
- No changes to request format

---

## Performance Considerations

### Startup Time

| Phase | Single Model | 3-Model Ensemble |
|---|---|---|
| Model loading | ~2s | ~6-8s |
| FAISS index loading | ~0.1s | ~0.3s |
| **Total** | **~2.1s** | **~6-8.3s** |

First-run startup is slower due to model downloads (~350 MB total for 3 models). Subsequent starts use cached models.

### Memory Usage

| Resource | Single Model | 3-Model Ensemble |
|---|---|---|
| Model weights (RAM) | ~90 MB | ~500 MB |
| FAISS indices (per 1K resumes) | ~1.5 MB | ~6 MB |
| **Total baseline** | **~92 MB** | **~506 MB** |

### Search Latency

| Phase | Single Model | 3-Model Ensemble |
|---|---|---|
| Query embedding | ~5ms | ~15ms |
| FAISS search | ~1ms | ~3ms |
| RRF fusion | — | ~0.1ms |
| MongoDB hydration | ~5ms | ~5ms |
| **Total** | **~11ms** | **~23ms** |

The ~2x latency increase is negligible for interactive search (still under 50ms).

### Ingestion Throughput

| Phase | Single Model | 3-Model Ensemble |
|---|---|---|
| Text embedding | ~50ms/doc | ~150ms/doc |
| FAISS add | ~0.1ms | ~0.3ms |
| **Per-document** | **~50ms** | **~150ms** |

Ingestion is 3x slower per document, which is acceptable for batch background processing.

---

## Single-Model vs Ensemble Comparison

| Aspect | Single Model | Ensemble (3 Models) |
|---|---|---|
| **Search quality** | Good for common queries | Better for diverse query types |
| **Paraphrase handling** | Moderate | Excellent (MPNet) |
| **Question-style queries** | Moderate | Excellent (Multi-QA) |
| **Robustness** | Single point of failure | Graceful degradation |
| **Startup time** | ~2s | ~7s |
| **Memory** | ~90 MB | ~500 MB |
| **Search latency** | ~11ms | ~23ms |
| **Extensibility** | Add model = rebuild everything | Add model = add to comma list |

---

## Data Flow Diagrams

### Ingestion Flow

```
PDF/TXT Upload
      │
      ▼
  Parse Text ──► Clean Text
                     │
                     ▼
              ┌──────┴──────────────────────┐
              │  EnsembleEmbeddingService    │
              │  embed_text(cleaned_text)    │
              └──────┬──────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   vec_minilm   vec_mpnet   vec_multiqa
         │           │           │
         └─────┬─────┴─────┬─────┘
               │           │
               ▼           ▼
        ┌──────────┐ ┌──────────┐
        │ MongoDB  │ │ Ensemble │
        │ (text +  │ │ FAISS    │
        │ metadata)│ │ (3 indices)
        └──────────┘ └──────────┘
```

### Search Flow

```
Natural Language Query
         │
         ▼
  ┌──────┴──────────────────────┐
  │  EnsembleEmbeddingService   │
  │  embed_text(query)          │
  └──────┬──────────────────────┘
         │
    ┌────┼────┐
    ▼    ▼    ▼
  FAISS FAISS FAISS      ◄── 3 separate searches
  idx1  idx2  idx3
    │    │    │
    ▼    ▼    ▼
  Rank  Rank  Rank       ◄── 3 independent ranked lists
  List1 List2 List3
    │    │    │
    └────┼────┘
         │
         ▼
  ┌──────────────────┐
  │ Reciprocal Rank  │   ◄── Fuse into single ranking
  │ Fusion (k=60)    │
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ MongoDB Hydration│   ◄── Fetch candidate details
  └──────┬───────────┘
         │
         ▼
  Final JSON Response
  (with per_model_scores)
```

---

## Migration Guide

### From Single-Model to Ensemble

1. **Update `.env`**:
   ```env
   ENSEMBLE_MODELS=all-MiniLM-L6-v2,all-mpnet-base-v2,multi-qa-MiniLM-L6-cos-v1
   ENSEMBLE_FUSION_K=60
   ```

2. **Clean FAISS data** (the old single-model index is incompatible):
   ```powershell
   Remove-Item -Recurse -Force .\backend\faiss_store\*
   ```

3. **Install new models** (automatic on first startup):
   ```powershell
   # Models are downloaded automatically by sentence-transformers
   # Ensure ~500 MB of disk space and internet access
   ```

4. **Re-index existing resumes**: Upload your existing resumes again, or trigger a re-index from MongoDB raw text (manual process).

5. **Restart the backend**:
   ```powershell
   .\.venv\Scripts\uvicorn app.main:app --reload --port 8000
   ```

### Adding a New Model

To add a 4th model to the ensemble:

1. Add the model name to `ENSEMBLE_MODELS` in `.env`:
   ```env
   ENSEMBLE_MODELS=all-MiniLM-L6-v2,all-mpnet-base-v2,multi-qa-MiniLM-L6-cos-v1,paraphrase-multilingual-MiniLM-L12-v2
   ```

2. Restart the backend. The new model's FAISS index will be created empty.

3. Re-index existing resumes to populate the new model's index.

### Removing a Model

Remove the model name from `ENSEMBLE_MODELS`. The orphaned FAISS files can be manually cleaned:

```powershell
Remove-Item .\backend\faiss_store\index_<model_slug>.bin
Remove-Item .\backend\faiss_store\id_map_<model_slug>.json
```

---

## References

- Cormack, G.V., Clarke, C.L., & Buettcher, S. (2009). *Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods.* SIGIR '09.
- Reimers, N. & Gurevych, I. (2019). *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.* EMNLP 2019.
- [Sentence-Transformers Documentation](https://www.sbert.net/)
- [FAISS Documentation](https://github.com/facebookresearch/faiss)
