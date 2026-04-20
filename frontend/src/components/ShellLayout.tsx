import { useState } from "react";
import type { FormEvent } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";

const navItems = [
  { to: "/upload", label: "Upload" },
  { to: "/search", label: "Search" },
  { to: "/resumes", label: "Resumes" },
];

export function ShellLayout() {
  const { user, logout } = useAuth();
  const { workspaces, selectedWorkspaceId, selectedWorkspace, selectWorkspace, createWorkspaceAndSelect, loading } = useWorkspace();
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createWorkspaceAndSelect(name);
      setWorkspaceName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#dbeafe_0%,transparent_30%),radial-gradient(circle_at_80%_10%,#fef3c7_0%,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-600">Recruiter Studio</p>
            <h1 className="text-xl font-semibold text-slate-900">Semantic Resume Retrieval</h1>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedWorkspaceId ?? ""}
                onChange={(event) => selectWorkspace(event.target.value)}
                className="min-w-[210px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                disabled={loading || workspaces.length === 0}
              >
                {workspaces.length === 0 && <option value="">No workspaces yet</option>}
                {workspaces.map((workspace) => (
                  <option key={workspace.workspace_id} value={workspace.workspace_id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Logout
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="flex flex-wrap items-center gap-2">
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Create new workspace"
                className="min-w-[210px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {busy ? "Creating..." : "Create"}
              </button>
            </form>

            <nav className="flex gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <p className="text-xs text-slate-500">Active workspace: {selectedWorkspace?.name ?? "None selected"}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
