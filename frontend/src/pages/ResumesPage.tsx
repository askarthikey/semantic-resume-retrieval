import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../api/client";
import { deleteResume, listResumes } from "../api/resumes";
import type { ResumeListItem } from "../api/types";
import { Toast } from "../components/Toast";
import { useWorkspace } from "../contexts/WorkspaceContext";

type ToastState = { message: string; kind: "success" | "error" | "info" };

const PAGE_SIZE = 10;

/**
 * PyMongo returns naive UTC datetimes (no tzinfo), so Pydantic serializes them
 * WITHOUT a timezone suffix: "2026-04-21T05:31:49". JavaScript then treats
 * strings without a timezone as LOCAL time, which in IST means "5:31 AM IST"
 * instead of "5:31 AM UTC". Appending "Z" forces the parser to treat it as UTC.
 */
function parseAsUTC(ts: string): Date {
  if (!ts.endsWith("Z") && !ts.includes("+") && !/[+-]\d{2}:\d{2}$/.test(ts)) {
    return new Date(ts + "Z");
  }
  return new Date(ts);
}

export function ResumesPage() {
  const { selectedWorkspaceId, selectedWorkspace } = useWorkspace();
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  async function loadPage(nextPage: number, options?: { showLoading?: boolean }) {
    if (!selectedWorkspaceId) {
      setItems([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    if (options?.showLoading ?? true) setLoading(true);
    try {
      const response = await listResumes(nextPage, PAGE_SIZE);
      setItems(response.resumes);
      setPage(response.page);
      setTotalPages(response.total_pages);
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void loadPage(1, { showLoading: false }); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId]);

  async function handleDelete(mongoId: string) {
    try {
      await deleteResume(mongoId);
      setToast({ kind: "success", message: "Resume deleted." });
      await loadPage(page);
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
    }
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid var(--border-default)",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-default)",
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Resume Inventory
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)", maxWidth: 520 }}>
          Browse indexed resumes and remove stale profiles.
        </p>
        {selectedWorkspace && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Workspace: <span style={{ color: "var(--brand)", fontWeight: 600 }}>{selectedWorkspace.name}</span>
          </p>
        )}
      </header>

      {/* Table card */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "48px 24px" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--brand)", animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--bg-overlay)" }}>
                <tr>
                  <th style={thStyle}>Candidate</th>
                  <th style={thStyle}>File</th>
                  <th style={thStyle}>Uploaded</th>
                  <th style={thStyle}>Download</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.mongo_id}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-overlay)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                    style={{ transition: "background 0.1s" }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: "var(--text-primary)" }}>
                      {item.candidate_name}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{item.filename}</td>
                    <td style={tdStyle}>{parseAsUTC(item.upload_timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })}</td>
                    <td style={tdStyle}>
                      {item.file_storage?.download_url ? (
                        <a
                          href={item.file_storage.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none", fontSize: 12 }}
                        >
                          View ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Unavailable</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => handleDelete(item.mongo_id)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--error-border)",
                          borderRadius: 7,
                          color: "var(--error-text)",
                          padding: "5px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--error-bg)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      No resumes indexed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            onClick={() => void loadPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "1px solid var(--border-default)", borderRadius: 8,
              color: page <= 1 ? "var(--text-muted)" : "var(--text-secondary)",
              padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer",
              opacity: page <= 1 ? 0.5 : 1, transition: "border-color 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Previous
          </button>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Page <strong style={{ color: "var(--text-primary)" }}>{page}</strong> of{" "}
            <strong style={{ color: "var(--text-primary)" }}>{totalPages}</strong>
          </span>
          <button
            onClick={() => void loadPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "1px solid var(--border-default)", borderRadius: 8,
              color: page >= totalPages ? "var(--text-muted)" : "var(--text-secondary)",
              padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: page >= totalPages ? "not-allowed" : "pointer",
              opacity: page >= totalPages ? 0.5 : 1, transition: "border-color 0.15s",
            }}
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </section>
  );
}
