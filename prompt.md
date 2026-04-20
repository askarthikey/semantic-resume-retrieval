# Semantic Resume Retrieval System — Agent Prompt

## Overview

Build a full-stack application that enables recruiters to upload resumes and search for the most relevant candidates using natural language queries. The system understands meaning and context rather than matching exact keywords, powered by semantic embeddings and vector similarity search.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Python + FastAPI |
| Primary Database | MongoDB |
| Vector Database | FAISS (in-process, persisted to disk) |
| Embedding Model | `sentence-transformers` — use `all-MiniLM-L6-v2` |
| PDF Parsing | `pdfminer.six` or `PyMuPDF (fitz)` |

---

## What the System Does

1. A recruiter uploads one or more resumes (PDF or plain text).
2. The backend stores uploaded files in Supabase Storage and immediately returns an upload job ID.
3. Background processing extracts raw text from each resume, generates a semantic embedding vector, stores the resume metadata in MongoDB, and indexes the embedding in FAISS.
3. When the recruiter types a natural language search query (e.g., "machine learning engineer with neural networks experience"), the backend embeds the query using the same model and performs a similarity search in FAISS to find the top-N most relevant resumes.
4. The frontend displays ranked results with candidate name, similarity score, and resume highlights.

---

## Backend — FastAPI

### Embedding Pipeline

- Use the `sentence-transformers` library with the `all-MiniLM-L6-v2` model. This model produces 384-dimensional dense vectors.
- Load the model once at application startup and reuse it across requests.
- Every piece of text — resume content and search queries alike — must pass through this same model to ensure vectors are comparable.

### Resume Ingestion (`POST /resumes/upload`)

- Accept multipart file upload (PDF or `.txt`).
- Upload file bytes to Supabase Storage first and return `202 Accepted` quickly with `job_id`.
- Run parsing and indexing in a background worker for each accepted file.
- Extract full text from the stored object. For PDFs, use `pdfminer.six` or `PyMuPDF`. For plain text files, read directly.
- Clean the extracted text: remove excessive whitespace, fix encoding issues, strip irrelevant characters.
- Generate a 384-dim embedding vector from the cleaned text.
- Save the following to MongoDB when background processing succeeds:
  - `_id` (ObjectId)
  - `filename` (original file name)
  - `candidate_name` (attempt to extract from the top of the resume text; fall back to the filename)
  - `raw_text` (full cleaned text)
  - `upload_timestamp`
- After saving to MongoDB, get the new document's `_id`, convert it to a string, and add the embedding to the FAISS index using the integer position as the FAISS ID. Maintain a separate in-memory (and persisted) mapping of `faiss_id → mongo_id` so you can look up the MongoDB document from a FAISS search result.
- Persist the FAISS index to disk after each processed file so it survives restarts.
- Expose a polling endpoint `GET /resumes/upload-jobs/{job_id}` that returns aggregate progress and per-file states (`pending`, `processing`, `success`, `error`).

### FAISS Index Management

- Use `faiss.IndexFlatIP` (Inner Product) for similarity search. Normalize all vectors before adding them so that inner product equals cosine similarity.
- Keep the FAISS index and the `faiss_id → mongo_id` mapping list in a shared application-level state (e.g., a module-level singleton or a FastAPI lifespan context).
- On application startup, load the persisted FAISS index from disk if it exists; otherwise create a fresh one.
- The FAISS index file and the ID mapping JSON file should both be saved to a fixed local path (e.g., `./faiss_store/index.bin` and `./faiss_store/id_map.json`).

### Semantic Search (`POST /resumes/search`)

- Accept a JSON body with a `query` string and optional `top_k` integer (default 10).
- Generate a normalized embedding for the query.
- Run `index.search(query_vector, top_k)` on the FAISS index.
- FAISS returns distances (cosine scores) and FAISS IDs. Map each FAISS ID back to a MongoDB `_id` using the ID mapping.
- Fetch the corresponding documents from MongoDB.
- Return a ranked list of results, each containing:
  - `mongo_id`
  - `candidate_name`
  - `filename`
  - `similarity_score` (float between 0 and 1)
  - `snippet` — first 300 characters of the raw text as a preview

### Additional Endpoints

- `GET /resumes` — Return a paginated list of all uploaded resumes (metadata only, no embedding vectors).
- `GET /resumes/{id}` — Return full metadata and raw text for a single resume by MongoDB `_id`.
- `DELETE /resumes/{id}` — Remove the resume from MongoDB. Note: FAISS does not support direct deletion with `IndexFlatIP`; handle this by marking the record as deleted in MongoDB and filtering it out of search results, OR rebuild the FAISS index from the remaining MongoDB records.

### CORS

Enable CORS for all origins during development so the Vite dev server on port 5173 can communicate with FastAPI on port 8000.

---

## MongoDB Schema

### `resumes` collection

```
{
  _id: ObjectId,
  filename: String,
  candidate_name: String,
  raw_text: String,
  upload_timestamp: ISODate,
  is_deleted: Boolean (default false)
}
```

Do not store the embedding vector in MongoDB — that is FAISS's responsibility.

---

## Frontend — React + Vite

### Pages / Views

The app has two primary views accessible from a top navigation bar:

**1. Upload Page**
- A drag-and-drop file upload zone that accepts `.pdf` and `.txt` files. Allow selecting multiple files at once.
- On upload, send files once, receive a `job_id`, and poll job status endpoint every 1–2 seconds.
- Show a progress indicator and status per file based on job polling response.
- Show success when background processing completes successfully.
- On per-file failure, show error details while allowing other files in the same job to succeed.

**2. Search Page**
- A large, prominent search input field where the recruiter types a natural language query (e.g., "frontend developer with React and TypeScript experience").
- A "Search" button that triggers the API call.
- A `top_k` slider or dropdown allowing the recruiter to choose how many results to return (5, 10, 20).
- Results displayed as a ranked list of cards. Each card shows:
  - Rank number and similarity score (shown as a percentage or colored badge)
  - Candidate name
  - Filename
  - Text snippet (preview of the resume)
  - A "View Full Resume" button that opens a modal or side panel showing the full raw text.

**3. Resume List Page (optional but recommended)**
- A table or card grid of all uploaded resumes.
- Each entry shows candidate name, filename, and upload date.
- A delete button that calls `DELETE /resumes/{id}` and refreshes the list.

### API Communication

- Use `axios` or the native `fetch` API to communicate with the FastAPI backend at `http://localhost:8000`.
- All API calls should handle loading states and errors gracefully with user-facing feedback.

### State Management

- React's built-in `useState` and `useEffect` are sufficient. No need for Redux or Zustand unless complexity demands it.

---

## Key Behaviors and Business Rules

- **Same embedding model for everything.** The model used to embed resumes at upload time must be identical to the one used to embed queries at search time. Never mix models.
- **Normalize vectors.** Always L2-normalize vectors before adding to FAISS and before searching. This ensures cosine similarity semantics with `IndexFlatIP`.
- **Persistence on restart.** The FAISS index and the ID mapping must be saved to disk and reloaded on startup. Without this, all uploaded resumes become unsearchable after a server restart.
- **Graceful empty state.** If FAISS has no vectors yet and a search is performed, return an empty results list with a clear message rather than crashing.
- **Text quality matters.** Extracted resume text should be clean. Strip repeated newlines, null bytes, and garbled characters before embedding. Poor text degrades embedding quality.
- **Candidate name extraction.** Make a best-effort attempt to extract the candidate's name from the first few lines of the resume. A simple heuristic (first non-empty line that looks like a name) is acceptable. Fall back to the filename (without extension) if extraction fails.

---

## Environment Variables (Backend)

The backend should read configuration from a `.env` file using `python-dotenv`:

```
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=resume_retrieval
FAISS_INDEX_PATH=./faiss_store/index.bin
FAISS_IDMAP_PATH=./faiss_store/id_map.json
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

---

## Non-Functional Expectations

- The embedding model is loaded **once** at startup — not on every request. This is critical for performance.
- Resume upload acceptance should respond quickly because heavy processing runs in background.
- Search should respond within 1 second for up to a few thousand indexed resumes.
- The system should handle at least 1000 resumes without performance degradation, given FAISS's efficiency with flat indexes at that scale.

---

## Summary of API Contracts

| Method | Endpoint | Description |
|---|---|---|
| POST | `/resumes/upload` | Upload one or more resume files and create async ingestion job |
| GET | `/resumes/upload-jobs/{job_id}` | Get upload job progress and per-file outcomes |
| POST | `/resumes/search` | Semantic search with a natural language query |
| GET | `/resumes` | List all resumes (paginated) |
| GET | `/resumes/{id}` | Get a single resume by ID |
| DELETE | `/resumes/{id}` | Soft-delete a resume |

---

## Done Means

- A recruiter can upload 10 resumes in various formats without request timeout failures and track processing completion by job status.
- Once files are processed successfully in background, they become searchable using natural language queries.
- Results are ranked by semantic relevance, not keyword frequency.
- The system survives a server restart without losing any indexed resumes.
- The UI is clean, responsive, and provides clear feedback on all actions.
