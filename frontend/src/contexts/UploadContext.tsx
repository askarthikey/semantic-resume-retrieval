import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { getApiErrorMessage } from "../api/client";
import { createUploadJob, getUploadJobStatus } from "../api/resumes";
import type { UploadJobStatusResponse } from "../api/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type UploadItemState = {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

export type UploadToast = {
  message: string;
  kind: "success" | "error" | "info";
};

type UploadContextValue = {
  items: UploadItemState[];
  isUploading: boolean;
  activeJobId: string | null;
  toast: UploadToast | null;
  addFiles: (fileList: FileList | null) => void;
  handleUpload: (workspaceId: string) => Promise<void>;
  clearItems: () => void;
  dismissToast: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pure function — no mutation inside setItems updater (fixes StrictMode double-invoke bug).
 * Pre-computes the next state array from the server response, then the updater
 * only does a simple array replace.
 */
function computeNextItems(
  prev: UploadItemState[],
  response: UploadJobStatusResponse,
): UploadItemState[] {
  const usedIndices = new Set<number>();

  return prev.map((item) => {
    const entryIdx = response.files.findIndex(
      (f, i) => f.filename === item.file.name && !usedIndices.has(i),
    );
    if (entryIdx === -1) return item;
    usedIndices.add(entryIdx);
    const entry = response.files[entryIdx];

    if (entry.status === "success") {
      return { ...item, status: "success", progress: 100, error: undefined };
    }
    if (entry.status === "error") {
      return {
        ...item,
        status: "error",
        progress: 100,
        error: entry.error ?? "Processing failed",
      };
    }
    if (entry.status === "processing") {
      return { ...item, status: "uploading", progress: Math.max(item.progress, 70) };
    }
    return { ...item, status: "uploading", progress: Math.max(item.progress, 30) };
  });
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<UploadItemState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [toast, setToast] = useState<UploadToast | null>(null);

  // Keep a ref to items so the polling closure always has the latest snapshot
  // without needing items in its dependency array.
  const itemsRef = useRef<UploadItemState[]>(items);
  itemsRef.current = items;

  // Allows external code to cancel a running poll loop (e.g. on logout)
  const stopPollingRef = useRef(false);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const next = Array.from(fileList).map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }));
    setItems((prev) => [...prev, ...next]);
  }, []);

  const clearItems = useCallback(() => {
    if (!isUploading) setItems([]);
  }, [isUploading]);

  const dismissToast = useCallback(() => setToast(null), []);

  const handleUpload = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId) {
        setToast({ kind: "error", message: "Select or create a workspace first." });
        return;
      }
      if (itemsRef.current.length === 0) return;

      setIsUploading(true);
      stopPollingRef.current = false;
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          status: "uploading",
          progress: 20,
          error: undefined,
        })),
      );

      try {
        // Capture the files NOW (snapshot before async ops)
        const filesToUpload = itemsRef.current.map((i) => i.file);
        const accepted = await createUploadJob(filesToUpload);
        setActiveJobId(accepted.job_id);
        setToast({ kind: "info", message: "Files received — processing in background…" });

        // Polling loop — lives in the CONTEXT, survives page navigation
        for (let attempt = 0; attempt < 600; attempt += 1) {
          if (stopPollingRef.current) break;

          const status = await getUploadJobStatus(accepted.job_id);
          // Use a snapshot of the computed state to avoid stale closure in setItems
          const snapshot = computeNextItems(itemsRef.current, status);
          setItems(snapshot);

          const isTerminal =
            status.status === "completed" ||
            status.status === "failed" ||
            status.status === "partially_completed";

          if (isTerminal) {
            if (status.failure_count > 0) {
              setToast({
                kind: "error",
                message: `${status.success_count} file(s) processed, ${status.failure_count} failed.`,
              });
            } else {
              setToast({
                kind: "success",
                message: `All ${status.success_count} file(s) indexed successfully.`,
              });
            }
            break;
          }

          await delay(1200);
        }
      } catch (error) {
        setToast({ kind: "error", message: getApiErrorMessage(error) });
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            status: "error",
            progress: 100,
            error: "Upload failed",
          })),
        );
      } finally {
        setActiveJobId(null);
        setIsUploading(false);
      }
    },
    [],
  );

  const value = useMemo<UploadContextValue>(
    () => ({
      items,
      isUploading,
      activeJobId,
      toast,
      addFiles,
      handleUpload,
      clearItems,
      dismissToast,
    }),
    [items, isUploading, activeJobId, toast, addFiles, handleUpload, clearItems, dismissToast],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}
