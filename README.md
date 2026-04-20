# Semantic Resume Retrieval

A full-stack recruiter tool for semantic resume ingestion and retrieval.

The backend extracts text from resumes, embeds content with `all-MiniLM-L6-v2`, stores metadata in MongoDB, indexes vectors in FAISS, and exposes search/list/detail/delete APIs. The frontend provides Upload, Search, and Resumes pages connected to those APIs.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind |
| Backend | FastAPI, PyMuPDF, sentence-transformers, FAISS |
| Database | MongoDB |

## Repository structure

| Path | Purpose |
|---|---|
| `backend/app/main.py` | FastAPI app, lifespan container, CORS, health endpoint |
| `backend/app/routers/resumes.py` | Resume upload/search/list/detail/delete APIs |
| `backend/app/repositories/mongo_repository.py` | MongoDB persistence (with soft delete) |
| `backend/app/repositories/faiss_repository.py` | FAISS index + `faiss_id -> mongo_id` persistence |
| `backend/app/services/` | Parsing, text cleaning, embedding |
| `frontend/src/pages/` | Upload/Search/Resumes UI pages |
| `frontend/src/api/` | Axios client and API wrappers |

## End-to-end architecture

1. Resume files (`.pdf`, `.txt`) are uploaded to `POST /resumes/upload`.
2. Backend extracts text, normalizes/cleans text, generates an embedding, writes metadata to MongoDB, then stores vector in FAISS.
3. Query text is sent to `POST /resumes/search`.
4. Query embedding is searched in FAISS, then matched to MongoDB docs via persisted ID mapping.
5. Frontend renders ranked results, detail modal, and inventory controls.

## Backend setup (Windows PowerShell)

```powershell
Set-Location .\backend
py -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

### Backend environment variables (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection URI |
| `MONGO_DB_NAME` | `resume_retrieval` | MongoDB database name |
| `FAISS_INDEX_PATH` | `./faiss_store/index.bin` | Persisted FAISS index file |
| `FAISS_IDMAP_PATH` | `./faiss_store/id_map.json` | Persisted FAISS ID mapping file |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformer model name |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins |

## Frontend setup (Windows PowerShell)

```powershell
Set-Location .\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

`VITE_API_BASE_URL` defaults to `/api`, and Vite proxies `/api/*` to `http://localhost:8000/*` in dev.

### Frontend environment variables (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Axios base URL for backend APIs |

## API contract

### `POST /resumes/upload`
- Multipart field: `files` (one or more `.pdf` / `.txt`)
- Response:
  - `success: boolean`
  - `uploaded: [{ mongo_id, filename, candidate_name, upload_timestamp }]`
  - `failed: [{ filename, error }]`

### `POST /resumes/search`
- Body:
```json
{
  "query": "machine learning engineer with neural networks experience",
  "top_k": 10
}
```
- Response:
  - `query`
  - `results: [{ rank, mongo_id, candidate_name, filename, similarity_score, snippet }]`
  - `total`
  - `message` (optional)

### `GET /resumes?page=1&page_size=20`
- Paginated metadata list (no full resume text).

### `GET /resumes/{id}`
- Full resume details (including `raw_text`).

### `DELETE /resumes/{id}`
- Soft-delete in MongoDB (`is_deleted=true`), filtered out from list/search.

### `GET /health`
- Returns:
```json
{
  "status": "ok",
  "service": "semantic-resume-retrieval",
  "version": 1
}
```

## Development commands

### Backend

```powershell
Set-Location .\backend
.\.venv\Scripts\python -m pytest -q
```

### Frontend

```powershell
Set-Location .\frontend
npm run lint -- --max-warnings=0
npm run build
```

## Persistence details

FAISS data is persisted under `backend/faiss_store`:
- `index.bin` (vector index)
- `id_map.json` (`faiss_id -> mongo_id`)

On startup, backend reloads these files; if index and map are inconsistent, it rebuilds to a clean empty state to prevent corrupt lookups.

## Notes and behavior

- Embeddings are L2-normalized for both ingestion and search.
- Similarity scores are returned as normalized `0..1` values.
- Empty/unsupported files are rejected per-file during upload.
- Deletion is soft-delete by design (FAISS vectors remain, but deleted docs are filtered out from responses).
