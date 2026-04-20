import { useEffect, useMemo, useRef, useState } from "react";

import { getApiErrorMessage } from "../api/client";
import { createUploadJob, getUploadJobStatus } from "../api/resumes";
import type { UploadJobStatusResponse } from "../api/types";
import { Toast } from "../components/Toast";

type ToastState = {
  message: string;
  kind: "success" | "error";
};

type UploadItemState = {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

export function UploadPage() {
  const [items, setItems] = useState<UploadItemState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const isMountedRef = useRef(true);

  const acceptedTypes = useMemo(() => [".pdf", ".txt"], []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function applyJobStatus(response: UploadJobStatusResponse) {
    const buckets = new Map<string, UploadJobStatusResponse["files"]>();
    for (const entry of response.files) {
      const existing = buckets.get(entry.filename) ?? [];
      existing.push(entry);
      buckets.set(entry.filename, existing);
    }

    setItems((prev) =>
      prev.map((item) => {
        const queue = buckets.get(item.file.name) ?? [];
        const entry = queue.shift();
        buckets.set(item.file.name, queue);
        if (!entry) {
          return item;
        }

        if (entry.status === "success") {
          return { ...item, status: "success", progress: 100, error: undefined };
        }
        if (entry.status === "error") {
          return { ...item, status: "error", progress: 100, error: entry.error ?? "Processing failed" };
        }
        if (entry.status === "processing") {
          return { ...item, status: "uploading", progress: Math.max(item.progress, 70) };
        }
        return { ...item, status: "uploading", progress: Math.max(item.progress, 30) };
      }),
    );
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const selected = Array.from(fileList).map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }));
    setItems((prev) => [...prev, ...selected]);
  }

  async function handleUpload() {
    if (items.length === 0) return;
    setIsUploading(true);
    setItems((prev) => prev.map((item) => ({ ...item, status: "uploading", progress: 20, error: undefined })));

    try {
      const accepted = await createUploadJob(items.map((item) => item.file));
      setActiveJobId(accepted.job_id);
      setToast({ kind: "success", message: accepted.message });

      for (let attempt = 0; attempt < 600; attempt += 1) {
        if (!isMountedRef.current) {
          return;
        }

        const status = await getUploadJobStatus(accepted.job_id);
        applyJobStatus(status);

        const isTerminal =
          status.status === "completed" ||
          status.status === "failed" ||
          status.status === "partially_completed";
        if (isTerminal) {
          if (status.failure_count > 0) {
            setToast({
              kind: "error",
              message: `${status.success_count} file(s) processed, ${status.failure_count} file(s) failed.`,
            });
          } else {
            setToast({ kind: "success", message: `All ${status.success_count} file(s) processed successfully.` });
          }
          break;
        }

        await delay(1200);
      }
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
      setItems((prev) => prev.map((item) => ({ ...item, status: "error", progress: 100, error: "Upload failed" })));
    } finally {
      setActiveJobId(null);
      setIsUploading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Upload Resume Corpus</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Drop PDFs or plain text resumes and we will parse, clean, embed, and index them for semantic search.
        </p>
      </header>

      <div className="rounded-3xl border border-dashed border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 p-8">
        <label className="block cursor-pointer rounded-2xl border border-white/70 bg-white/80 p-10 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="block text-lg font-semibold text-slate-900">Drag and drop files here</span>
          <span className="mt-2 block text-sm text-slate-600">Accepted: {acceptedTypes.join(", ")}</span>
          <input
            type="file"
            accept={acceptedTypes.join(",")}
            multiple
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />
          <span className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Choose files
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleUpload}
          disabled={isUploading || items.length === 0}
          className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUploading ? "Uploading..." : "Upload Selected"}
        </button>
        <button
          onClick={() => setItems([])}
          disabled={isUploading || items.length === 0}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
        {activeJobId && <span className="text-sm text-slate-600">Job: {activeJobId}</span>}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={`${item.file.name}-${item.file.size}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">{item.file.name}</h3>
                <p className="text-xs text-slate-500">{Math.max(1, Math.round(item.file.size / 1024))} KB</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.status === "success"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.status === "error"
                      ? "bg-rose-100 text-rose-700"
                      : item.status === "uploading"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.status}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-sky-500 transition-all" style={{ width: `${item.progress}%` }} />
            </div>
            {item.error && <p className="mt-2 text-sm text-rose-600">{item.error}</p>}
          </article>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No files queued yet.</div>
        )}
      </div>

      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </section>
  );
}
