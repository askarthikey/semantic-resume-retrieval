import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../api/client";
import { deleteResume, listResumes } from "../api/resumes";
import type { ResumeListItem } from "../api/types";
import { Toast } from "../components/Toast";

type ToastState = {
  message: string;
  kind: "success" | "error";
};

const PAGE_SIZE = 10;

export function ResumesPage() {
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  async function loadPage(nextPage: number, options?: { showLoading?: boolean }) {
    if (options?.showLoading ?? true) {
      setLoading(true);
    }
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
    const timer = setTimeout(() => {
      void loadPage(1, { showLoading: false });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function handleDelete(mongoId: string) {
    try {
      await deleteResume(mongoId);
      setToast({ kind: "success", message: "Resume deleted." });
      await loadPage(page);
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Resume Inventory</h1>
        <p className="mt-2 text-slate-600">Browse all indexed resumes and remove stale profiles with one click.</p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">File</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Stored File</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.mongo_id}>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.candidate_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{item.filename}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{new Date(item.upload_timestamp).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {item.file_storage?.download_url ? (
                    <a
                      href={item.file_storage.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 transition hover:text-sky-800"
                    >
                      View/Download
                    </a>
                  ) : (
                    <span className="text-slate-400">Unavailable</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(item.mongo_id)}
                    className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  No resumes available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => void loadPage(Math.max(1, page - 1))}
          disabled={loading || page <= 1}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-slate-600">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => void loadPage(Math.min(totalPages, page + 1))}
          disabled={loading || page >= totalPages}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </section>
  );
}
