# Current Implementation Status

## Overall status

The project is implemented as a working full-stack system:
- Backend APIs are available for upload, search, listing, detail retrieval, delete, and health.
- Frontend pages are connected to backend APIs for core recruiter workflows.
- FAISS and ID mapping persistence are in place.

## Backend implementation

### App initialization (`backend/app/main.py`)
- FastAPI app with lifespan startup/shutdown.
- Shared `AppContainer` initialized once with:
  - MongoDB client + repository
  - FAISS repository
  - Embedding service (`SentenceTransformer`)
  - async write lock
- CORS configured from environment (`CORS_ORIGINS`).
- Health endpoint (`GET /health`) returns service status metadata.

### API routes (`backend/app/routers/resumes.py`)

1. `POST /resumes/upload`
   - Accepts multiple uploaded files.
   - Validates extension (`.pdf`, `.txt`).
   - Extracts text (`PyMuPDF` for PDFs, direct decode for text files).
   - Cleans text and rejects files with no extractable content.
   - Extracts candidate name heuristic from top lines (fallback to filename stem).
   - Embeds text, inserts Mongo record, inserts FAISS vector, persists index/map.
   - Returns per-file success/failure details.

2. `POST /resumes/search`
   - Validates non-empty query.
   - Handles empty-index state gracefully.
   - Embeds query, performs FAISS search.
   - Maps FAISS IDs to Mongo IDs, fetches docs from Mongo, skips deleted/missing docs.
   - Returns ranked result list with snippet and normalized `0..1` similarity score.

3. `GET /resumes`
   - Pagination (`page`, `page_size`) with validation.
   - Returns metadata-only list (no raw text) and paging metadata.

4. `GET /resumes/{id}`
   - Returns full resume detail including raw text.
   - 404 when not found/invalid.

5. `DELETE /resumes/{id}`
   - Soft delete in MongoDB (`is_deleted=true`).
   - 404 when not found/invalid.

### Repositories/services

- `MongoResumeRepository`
  - Create/get/list/soft-delete and batch-fetch by IDs.
  - Filters soft-deleted records from reads/search hydration.

- `FaissRepository`
  - Uses `faiss.IndexFlatIP` with persisted index and mapping files.
  - Detects index/map mismatch and resets to prevent inconsistent state.
  - Persists atomically via temp-file replace.

- `EmbeddingService`
  - Loads model once at app startup.
  - Embeds + L2 normalizes vectors.

- `text_processing.py`
  - Cleaning and candidate-name heuristic utilities.

## Frontend implementation

### API layer (`frontend/src/api`)
- Axios client with environment-based base URL:
  - `VITE_API_BASE_URL` (default `/api`)
- Strongly typed response models in `types.ts`.
- API wrappers in `resumes.ts`:
  - upload, search, list, detail, delete.
- Shared backend error message extraction helper.

### Vite connection (`frontend/vite.config.ts`)
- Dev proxy forwards `/api/*` -> `http://localhost:8000/*` with path rewrite.
- Enables frontend/backend local integration without hardcoded absolute URLs.

### UI pages

- `UploadPage`
  - Multi-file selection, progress-like status updates, success/error toast states.
  - Calls upload API and maps per-file failures.

- `SearchPage`
  - Query + top-k selection, semantic result cards, score badges.
  - “View Full Resume” opens detail modal via detail API call.

- `ResumesPage`
  - Paginated resume table from list API.
  - Delete action wired to delete API and refreshes current page.
  - Initial-load effect pattern adjusted to satisfy lint rules.

## Persistence and data model

- MongoDB collection: `resumes`
  - `_id`, `filename`, `candidate_name`, `raw_text`, `upload_timestamp`, `is_deleted`.
- Local files:
  - `backend/faiss_store/index.bin`
  - `backend/faiss_store/id_map.json`

## Known functional limitations (current design)

1. Delete uses soft-delete only; FAISS vectors are not physically removed.
2. Upload progress in UI is simulated status progression (not true stream byte progress).
3. Candidate name extraction is heuristic and may fall back to filename for some resume formats.

## Verification summary

- Backend unit tests pass (`pytest`).
- Frontend lint and production build pass after the integration updates.
