import type { ResumeDetail } from "../api/types";

type ResumeModalProps = {
  open: boolean;
  loading: boolean;
  resume: ResumeDetail | null;
  onClose: () => void;
};

export function ResumeModal({ open, loading, resume, onClose }: ResumeModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Full resume"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{resume?.candidate_name ?? "Resume"}</h3>
            <p className="text-sm text-slate-500">{resume?.filename ?? "Loading..."}</p>
            {resume?.file_storage?.download_url && (
              <a
                href={resume.file_storage.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 transition hover:text-sky-800"
              >
                Open stored file
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading && <p className="text-slate-600">Loading resume...</p>}
          {!loading && resume && (
            <div className="space-y-4">
              {resume.file_storage && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p>Bucket: {resume.file_storage.bucket}</p>
                  <p>Type: {resume.file_storage.mime_type}</p>
                  <p>Size: {Math.max(1, Math.round(resume.file_storage.size_bytes / 1024))} KB</p>
                </div>
              )}
              <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-slate-700">{resume.raw_text}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
