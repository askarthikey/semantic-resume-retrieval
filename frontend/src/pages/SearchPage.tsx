import { useState } from "react";

import { getApiErrorMessage } from "../api/client";
import { getResumeDetail, searchResumes } from "../api/resumes";
import type { ResumeDetail, SearchResult } from "../api/types";
import { ResumeModal } from "../components/ResumeModal";
import { Toast } from "../components/Toast";
import { useWorkspace } from "../contexts/WorkspaceContext";

type ToastState = {
  message: string;
  kind: "success" | "error";
};

const topKOptions = [5, 10, 20];

export function SearchPage() {
  const { selectedWorkspaceId, selectedWorkspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [selectedResume, setSelectedResume] = useState<ResumeDetail | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  async function handleSearch() {
    if (!selectedWorkspaceId) {
      setToast({ kind: "error", message: "Create or select a workspace before searching." });
      return;
    }
    if (!query.trim()) {
      setToast({ kind: "error", message: "Type a search query first." });
      return;
    }

    setIsSearching(true);
    setMessage(null);

    try {
      const response = await searchResumes(query.trim(), topK);
      setResults(response.results);
      setMessage(response.message ?? null);
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleViewResume(mongoId: string) {
    setModalOpen(true);
    setIsModalLoading(true);
    try {
      const detail = await getResumeDetail(mongoId);
      setSelectedResume(detail);
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
      setModalOpen(false);
      setSelectedResume(null);
    } finally {
      setIsModalLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Semantic Candidate Search</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Ask in natural language and rank resumes by semantic relevance, not raw keyword overlap.
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-500">Workspace: {selectedWorkspace?.name ?? "None"}</p>
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Example: machine learning engineer with neural networks experience"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
          />
          <select
            value={topK}
            onChange={(event) => setTopK(Number(event.target.value))}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
          >
            {topKOptions.map((option) => (
              <option key={option} value={option}>
                Top {option}
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p>}

      <div className="space-y-4">
        {results.map((result) => {
          const scorePercent = Math.round(result.similarity_score * 100);
          return (
            <article key={result.mongo_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Rank #{result.rank}</p>
                  <h3 className="text-xl font-semibold text-slate-900">{result.candidate_name}</h3>
                  <p className="text-sm text-slate-500">{result.filename}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    scorePercent > 84
                      ? "bg-emerald-100 text-emerald-700"
                      : scorePercent > 59
                        ? "bg-sky-100 text-sky-700"
                        : scorePercent > 34
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {scorePercent}% match
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{result.snippet || "No preview text available."}</p>
              <div className="mt-4">
                <button
                  onClick={() => handleViewResume(result.mongo_id)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  View Full Resume
                </button>
              </div>
            </article>
          );
        })}

        {!isSearching && results.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Start by running a semantic search query.
          </div>
        )}
      </div>

      <ResumeModal
        open={modalOpen}
        loading={isModalLoading}
        resume={selectedResume}
        onClose={() => {
          setModalOpen(false);
          setSelectedResume(null);
        }}
      />
      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </section>
  );
}
