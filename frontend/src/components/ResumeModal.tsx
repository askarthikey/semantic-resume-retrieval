import type { ResumeDetail } from "../api/types";

type ResumeModalProps = {
  open: boolean;
  loading: boolean;
  resume: ResumeDetail | null;
  onClose: () => void;
};

export function ResumeModal({ open, loading, resume, onClose }: ResumeModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full resume"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {resume?.candidate_name ?? "Resume"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              {resume?.filename ?? "Loading…"}
            </p>
            {resume?.file_storage?.download_url && (
              <a
                href={resume.file_storage.download_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, fontWeight: 600, color: "var(--brand)", textDecoration: "none" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open stored file
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-default)", borderRadius: 8, color: "var(--text-secondary)", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--brand)", animation: "spin 0.8s linear infinite" }} />
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Loading resume…</p>
            </div>
          )}
          {!loading && resume && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {resume.file_storage && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { label: "Bucket", value: resume.file_storage.bucket },
                    { label: "Type", value: resume.file_storage.mime_type },
                    { label: "Size", value: `${Math.max(1, Math.round(resume.file_storage.size_bytes / 1024))} KB` },
                  ].map((chip) => (
                    <span key={chip.label} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "var(--bg-overlay)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--text-muted)" }}>{chip.label}: </span>{chip.value}
                    </span>
                  ))}
                </div>
              )}
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px" }}>
                {resume.raw_text}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
