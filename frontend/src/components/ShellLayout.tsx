import { useState } from "react";
import type { FormEvent } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useUpload } from "../contexts/UploadContext";
import { useWorkspace } from "../contexts/WorkspaceContext";

const navItems = [
  {
    to: "/upload",
    label: "Upload",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    to: "/search",
    label: "Search",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    to: "/resumes",
    label: "Resumes",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export function ShellLayout() {
  const { user, logout } = useAuth();
  const { workspaces, selectedWorkspaceId, selectedWorkspace, selectWorkspace, createWorkspaceAndSelect, loading } =
    useWorkspace();
  const { isUploading, items } = useUpload();
  const uploadingCount = items.filter((i) => i.status === "uploading" || i.status === "pending").length;
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createWorkspaceAndSelect(name);
      setWorkspaceName("");
      setShowCreateForm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        style={{
          width: "var(--sidebar-w)",
          minWidth: "var(--sidebar-w)",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-default)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: "20px 16px 16px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Green logo mark */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Resume Studio
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Recruiter Suite</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 6px 8px",
            }}
          >
            Navigation
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                marginBottom: 2,
                transition: "background 0.15s, color 0.15s",
                background: isActive ? "var(--brand-muted)" : "transparent",
                color: isActive ? "var(--brand)" : "var(--text-secondary)",
                border: isActive ? "1px solid var(--border-brand)" : "1px solid transparent",
              })}
            >
              {item.icon}
              {item.label}
              {/* Pulsing badge on Upload nav item while processing */}
              {item.to === "/upload" && isUploading && (
                <span
                  style={{
                    marginLeft: "auto",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--warning-text)",
                    animation: "pulse-brand 1s ease infinite",
                    flexShrink: 0,
                  }}
                  title={`${uploadingCount} file${uploadingCount !== 1 ? "s" : ""} processing`}
                />
              )}
            </NavLink>
          ))}

          {/* Workspace section */}
          <div style={{ marginTop: 24 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "0 6px 8px",
              }}
            >
              Workspace
            </p>

            {/* Workspace selector */}
            <div style={{ padding: "0 4px" }}>
              {loading ? (
                <div style={{ padding: "8px 6px", fontSize: 12, color: "var(--text-muted)" }}>Loading…</div>
              ) : workspaces.length > 0 ? (
                <select
                  value={selectedWorkspaceId ?? ""}
                  onChange={(e) => selectWorkspace(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg-overlay)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    padding: "7px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {workspaces.map((ws) => (
                    <option key={ws.workspace_id} value={ws.workspace_id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 6px", margin: 0 }}>
                  No workspaces yet
                </p>
              )}

              {/* Active workspace label */}
              {selectedWorkspace && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 6px 0", lineHeight: 1.4 }}>
                  Active:{" "}
                  <span style={{ color: "var(--brand)", fontWeight: 600 }}>{selectedWorkspace.name}</span>
                </p>
              )}

              {/* Create workspace */}
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                style={{
                  marginTop: 10,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: "1px dashed var(--border-strong)",
                  borderRadius: 8,
                  color: "var(--text-secondary)",
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--brand)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New workspace
              </button>

              {showCreateForm && (
                <form
                  onSubmit={handleCreateWorkspace}
                  style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Workspace name…"
                    autoFocus
                    style={{
                      background: "var(--bg-overlay)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 8,
                      color: "var(--text-primary)",
                      padding: "7px 10px",
                      fontSize: 12,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={busy || !workspaceName.trim()}
                    style={{
                      background: busy || !workspaceName.trim() ? "var(--bg-subtle)" : "var(--brand)",
                      color: busy || !workspaceName.trim() ? "var(--text-muted)" : "var(--text-inverse)",
                      border: "none",
                      borderRadius: 8,
                      padding: "7px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: busy || !workspaceName.trim() ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {busy ? "Creating…" : "Create"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </nav>

        {/* User footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            style={{
              background: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              color: "var(--text-muted)",
              padding: "5px 8px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error-border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--error-text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header
          style={{
            height: 52,
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 12,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--brand)",
              boxShadow: "0 0 8px var(--brand)",
            }}
          />
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            {selectedWorkspace ? (
              <>
                <span style={{ color: "var(--text-secondary)" }}>Workspace</span>{" "}
                <span style={{ color: "var(--brand)", fontWeight: 600 }}>{selectedWorkspace.name}</span>
              </>
            ) : (
              <span>No workspace selected</span>
            )}
          </p>
        </header>

        <main style={{ flex: 1, padding: "28px 32px", width: "100%" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
