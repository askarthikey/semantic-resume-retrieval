type ToastProps = {
  message: string;
  kind: "success" | "error";
  onClose: () => void;
};

export function Toast({ message, kind, onClose }: ToastProps) {
  return (
    <div
      className={`fixed right-4 top-4 z-50 min-w-[260px] max-w-[420px] rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
        kind === "success"
          ? "border-emerald-300 bg-emerald-50/95 text-emerald-900"
          : "border-rose-300 bg-rose-50/95 text-rose-900"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-black/10"
          aria-label="Close notification"
        >
          Close
        </button>
      </div>
    </div>
  );
}
