import { useCallback, useMemo, useState } from "react";

import { Toast } from "../components/Toast";
import { useUpload, type UploadItemState } from "../contexts/UploadContext";
import { useWorkspace } from "../contexts/WorkspaceContext";

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_META: Record<
  UploadItemState["status"],
  { label: string; bg: string; color: string; dot: string }
> = {
  pending:   { label: "Queued",     bg: "var(--bg-overlay)",  color: "var(--text-muted)",    dot: "var(--text-muted)" },
  uploading: { label: "Processing", bg: "var(--warning-bg)",  color: "var(--warning-text)",  dot: "var(--warning-text)" },
  success:   { label: "Indexed",    bg: "var(--success-bg)",  color: "var(--success-text)",  dot: "var(--brand)" },
  error:     { label: "Failed",     bg: "var(--error-bg)",    color: "var(--error-text)",    dot: "var(--error-text)" },
};

// ─── Small summary row at the top of queue panel ──────────────────────────────
function QueueSummary({ items }: { items: UploadItemState[] }) {
  const counts = useMemo(() => {
    const c = { pending: 0, uploading: 0, success: 0, error: 0 };
    for (const item of items) c[item.status]++;
    return c;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      {(["pending", "uploading", "success", "error"] as UploadItemState["status"][])
        .filter((s) => counts[s] > 0)
        .map((s) => {
          const m = STATUS_META[s];
          return (
            <span
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: m.bg,
                color: m.color,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: m.dot,
                  animation: s === "uploading" ? "pulse-brand 1.2s ease infinite" : "none",
                }}
              />
              {counts[s]} {m.label}
            </span>
          );
        })}
    </div>
  );
}

// ─── Individual file row ──────────────────────────────────────────────────────
function FileRow({ item }: { item: UploadItemState }) {
  const m = STATUS_META[item.status];
  const isActive = item.status === "uploading";

  return (
    <div
      style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-default)",
        borderLeft: `3px solid ${m.dot}`,
        borderRadius: 8,
        padding: "11px 14px",
        animation: "fadeInUp 0.18s ease",
      }}
    >
      {/* Name + badge row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {/* File icon */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.file.name}
          </p>
        </div>
        <span
          style={{
            padding: "2px 9px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            background: m.bg,
            color: m.color,
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {m.label}
        </span>
      </div>

      {/* Size + progress row */}
      <p style={{ margin: "0 0 7px", fontSize: 11, color: "var(--text-muted)" }}>
        {Math.max(1, Math.round(item.file.size / 1024))} KB
        {item.progress > 0 && item.progress < 100 && ` · ${item.progress}%`}
      </p>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 999, background: "var(--bg-surface)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 999,
            width: `${item.progress}%`,
            transition: "width 0.5s ease",
            background:
              item.status === "success"
                ? "var(--brand)"
                : item.status === "error"
                ? "var(--error-text)"
                : isActive
                ? "linear-gradient(90deg, var(--brand) 0%, #86efcb 50%, var(--brand) 100%)"
                : "var(--border-strong)",
            backgroundSize: isActive ? "200% 100%" : undefined,
            animation: isActive ? "shimmer-bar 2s ease infinite" : undefined,
          }}
        />
      </div>

      {item.error && (
        <p style={{ margin: "7px 0 0", fontSize: 11, color: "var(--error-text)", lineHeight: 1.4 }}>
          {item.error}
        </p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function UploadPage() {
  const { selectedWorkspaceId, selectedWorkspace } = useWorkspace();
  const { items, isUploading, activeJobId, toast, addFiles, handleUpload, clearItems, dismissToast } =
    useUpload();

  const [dragging, setDragging] = useState(false);
  const acceptedTypes = useMemo(() => [".pdf", ".txt"], []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const pendingCount  = items.filter((i) => i.status === "pending").length;
  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  const successCount  = items.filter((i) => i.status === "success").length;
  const errorCount    = items.filter((i) => i.status === "error").length;
  const allDone       = items.length > 0 && uploadingCount === 0 && pendingCount === 0;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Upload Resumes
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Parse, embed and index resumes for semantic search.
              {selectedWorkspace && (
                <>
                  {" "}Workspace:{" "}
                  <span style={{ color: "var(--brand)", fontWeight: 600 }}>{selectedWorkspace.name}</span>
                </>
              )}
            </p>
          </div>

          {/* Live activity indicator (visible from other pages but here too) */}
          {isUploading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-border)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                color: "var(--warning-text)",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--warning-text)",
                  animation: "pulse-brand 1s ease infinite",
                }}
              />
              Processing {uploadingCount + pendingCount} file{uploadingCount + pendingCount !== 1 ? "s" : ""}…
            </div>
          )}
        </div>
      </header>

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ─── LEFT COLUMN: Drop zone + actions ─────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              flex: 1,
              border: `2px dashed ${dragging ? "var(--brand)" : "var(--border-default)"}`,
              borderRadius: 14,
              background: dragging ? "var(--brand-muted)" : "var(--bg-surface)",
              transition: "border-color 0.2s, background 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              padding: 32,
              minHeight: 320,
              cursor: "default",
            }}
          >
            {/* Upload cloud icon */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: dragging ? "var(--brand-muted)" : "var(--bg-overlay)",
                border: `1px solid ${dragging ? "var(--border-brand)" : "var(--border-default)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={dragging ? "var(--brand)" : "var(--text-muted)"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: "stroke 0.2s" }}
              >
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>

            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {dragging ? "Release to add files" : "Drag & drop resumes here"}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Supported formats: <strong style={{ color: "var(--text-secondary)" }}>.pdf</strong> and{" "}
                <strong style={{ color: "var(--text-secondary)" }}>.txt</strong>
              </p>
            </div>

            {/* Browse button */}
            <label style={{ cursor: "pointer" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 24px",
                  background: "var(--bg-overlay)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  transition: "border-color 0.15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Browse files
              </span>
              <input
                type="file"
                accept={acceptedTypes.join(",")}
                multiple
                style={{ display: "none" }}
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>

            {items.length > 0 && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-secondary)" }}>{items.length}</strong> file
                {items.length !== 1 ? "s" : ""} queued
              </p>
            )}
          </div>

          {/* Action bar */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => void handleUpload(selectedWorkspaceId ?? "")}
              disabled={isUploading || items.length === 0}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: isUploading || items.length === 0 ? "not-allowed" : "pointer",
                background: isUploading || items.length === 0 ? "var(--bg-subtle)" : "var(--brand)",
                color: isUploading || items.length === 0 ? "var(--text-muted)" : "var(--text-inverse)",
                transition: "background 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {isUploading ? (
                <>
                  <div
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      border: "2px solid var(--text-muted)",
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Uploading…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                  Upload {items.length > 0 ? `(${items.length})` : ""}
                </>
              )}
            </button>

            <button
              onClick={clearItems}
              disabled={isUploading || items.length === 0}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid var(--border-default)",
                cursor: isUploading || items.length === 0 ? "not-allowed" : "pointer",
                background: "transparent",
                color: isUploading || items.length === 0 ? "var(--text-muted)" : "var(--text-secondary)",
                opacity: isUploading || items.length === 0 ? 0.5 : 1,
              }}
            >
              Clear
            </button>

            {activeJobId && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "monospace",
                  background: "var(--bg-overlay)",
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default)",
                }}
              >
                job·{activeJobId.slice(-8)}
              </span>
            )}
          </div>
        </div>

        {/* ─── RIGHT COLUMN: Live queue ──────────────────────────────────── */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
                UPLOAD QUEUE
              </p>
              {items.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: "var(--bg-overlay)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {items.length}
                </span>
              )}
            </div>

            {/* Completion check mark */}
            {allDone && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: errorCount > 0 ? "var(--warning-text)" : "var(--brand)", fontWeight: 600 }}>
                {errorCount === 0 ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    All done
                  </>
                ) : (
                  <>{successCount} ok · {errorCount} failed</>
                )}
              </div>
            )}
          </div>

          {/* Summary pills */}
          {items.length > 0 && (
            <div style={{ padding: "10px 18px 0" }}>
              <QueueSummary items={items} />
            </div>
          )}

          {/* File list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 14px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {items.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: "40px 24px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: "var(--bg-overlay)",
                    border: "1px solid var(--border-default)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                    No files queued
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Add resumes using the drop zone or browse button
                  </p>
                </div>
              </div>
            ) : (
              items.map((item) => (
                <FileRow key={`${item.file.name}-${item.file.size}`} item={item} />
              ))
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} kind={toast.kind} onClose={dismissToast} />}
    </section>
  );
}
