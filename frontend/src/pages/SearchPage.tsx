import { useState } from "react";

import { getApiErrorMessage } from "../api/client";
import { getResumeDetail, searchResumes } from "../api/resumes";
import type { ResumeDetail, SearchResult } from "../api/types";
import { ResumeModal } from "../components/ResumeModal";
import { Toast } from "../components/Toast";
import { useWorkspace } from "../contexts/WorkspaceContext";

type ToastState = { message: string; kind: "success" | "error" | "info" };

const topKOptions = [5, 10, 20];

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct > 84 ? "var(--success-text)" :
    pct > 59 ? "var(--brand)" :
    pct > 34 ? "var(--warning-text)" :
               "var(--error-text)";
  const bg =
    pct > 84 ? "var(--success-bg)" :
    pct > 59 ? "var(--brand-muted)" :
    pct > 34 ? "var(--warning-bg)" :
               "var(--error-bg)";
  return (
    <span style={{ padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg, color }}>
      {pct}% match
    </span>
  );
}

export function SearchPage() {
  const { selectedWorkspaceId, selectedWorkspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [selectedResume, setSelectedResume] = useState<ResumeDetail | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  async function handleSearch() {
    if (!selectedWorkspaceId) {
      setToast({ kind: "error", message: "Select or create a workspace first." });
      return;
    }
    if (!query.trim()) {
      setToast({ kind: "error", message: "Enter a search query first." });
      return;
    }
    setIsSearching(true);
    setMessage(null);
    try {
      const response = await searchResumes(query.trim(), topK);
      setResults(response.results);
      setMessage(response.message ?? null);
      setHasSearched(true);
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

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: "var(--bg-overlay)",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    color: "var(--text-primary)",
    padding: "10px 14px",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.15s",
    minWidth: 0,
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Semantic Search
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)", maxWidth: 520 }}>
          Ask in natural language. Rank candidates by semantic relevance — not keyword overlap.
        </p>
        {selectedWorkspace && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Workspace: <span style={{ color: "var(--brand)", fontWeight: 600 }}>{selectedWorkspace.name}</span>
          </p>
        )}
      </header>

      {/* Search bar */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
            placeholder="e.g. machine learning engineer with Python and PyTorch experience"
            style={inputStyle}
            onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--brand)")}
            onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border-default)")}
          />
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              padding: "10px 12px",
              fontSize: 13,
              cursor: "pointer",
              outline: "none",
              flexShrink: 0,
            }}
          >
            {topKOptions.map((o) => (
              <option key={o} value={o}>Top {o}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            style={{
              padding: "10px 22px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: isSearching ? "not-allowed" : "pointer",
              background: isSearching ? "var(--bg-subtle)" : "var(--brand)",
              color: isSearching ? "var(--text-muted)" : "var(--text-inverse)",
              transition: "background 0.15s",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isSearching ? (
              <>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "var(--text-muted)", animation: "spin 0.8s linear infinite" }} />
                Searching…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Search
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info message */}
      {message && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--warning-text)" }}>
          {message}
        </div>
      )}

      {/* Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {results.map((result) => (
          <article
            key={result.mongo_id}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: "16px 18px",
              transition: "border-color 0.15s, background 0.15s",
              cursor: "default",
              animation: "fadeInUp 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLElement).style.background = "var(--bg-overlay)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
              (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  Rank #{result.rank}
                </p>
                <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  {result.candidate_name}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{result.filename}</p>
              </div>
              <ScoreBadge score={result.similarity_score} />
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
              {result.snippet || "No preview available."}
            </p>
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => handleViewResume(result.mongo_id)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: 7,
                  color: "var(--text-secondary)",
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--brand)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}
              >
                View full resume
              </button>
            </div>
          </article>
        ))}

        {!isSearching && hasSearched && results.length === 0 && (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>No results found for that query.</p>
          </div>
        )}

        {!hasSearched && (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>Run a search to see candidates here.</p>
          </div>
        )}
      </div>

      <ResumeModal
        open={modalOpen}
        loading={isModalLoading}
        resume={selectedResume}
        onClose={() => { setModalOpen(false); setSelectedResume(null); }}
      />
      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </section>
  );
}
