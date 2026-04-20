import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { createWorkspace, listWorkspaces } from "../api/auth";
import { setWorkspaceId } from "../api/client";
import type { Workspace } from "../api/types";
import { useAuth } from "./AuthContext";

const WORKSPACE_KEY = "workspace_id";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  selectedWorkspace: Workspace | null;
  loading: boolean;
  refresh: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => void;
  createWorkspaceAndSelect: (name: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => localStorage.getItem(WORKSPACE_KEY));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      return;
    }
    setLoading(true);
    try {
      const items = await listWorkspaces();
      setWorkspaces(items);

      if (items.length === 0) {
        localStorage.removeItem(WORKSPACE_KEY);
        setSelectedWorkspaceId(null);
        setWorkspaceId(null);
        return;
      }

      const stored = localStorage.getItem(WORKSPACE_KEY);
      const validSelection = stored && items.some((item) => item.workspace_id === stored) ? stored : items[0].workspace_id;
      localStorage.setItem(WORKSPACE_KEY, validSelection);
      setSelectedWorkspaceId(validSelection);
      setWorkspaceId(validSelection);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      setWorkspaceId(null);
      localStorage.removeItem(WORKSPACE_KEY);
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  const selectWorkspace = useCallback((workspaceId: string) => {
    localStorage.setItem(WORKSPACE_KEY, workspaceId);
    setSelectedWorkspaceId(workspaceId);
    setWorkspaceId(workspaceId);
  }, []);

  const createWorkspaceAndSelect = useCallback(
    async (name: string) => {
      const created = await createWorkspace(name);
      const next = [created, ...workspaces.filter((item) => item.workspace_id !== created.workspace_id)];
      setWorkspaces(next);
      localStorage.setItem(WORKSPACE_KEY, created.workspace_id);
      setSelectedWorkspaceId(created.workspace_id);
      setWorkspaceId(created.workspace_id);
    },
    [workspaces],
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((item) => item.workspace_id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      selectedWorkspaceId,
      selectedWorkspace,
      loading,
      refresh,
      selectWorkspace,
      createWorkspaceAndSelect,
    }),
    [createWorkspaceAndSelect, loading, refresh, selectWorkspace, selectedWorkspace, selectedWorkspaceId, workspaces],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
