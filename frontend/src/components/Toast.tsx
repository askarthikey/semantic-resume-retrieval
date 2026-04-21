import { useEffect, useRef, useState } from "react";

type ToastProps = {
  message: string;
  kind: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
};

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const STYLES = {
  success: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderLeft: "3px solid var(--brand)",
    iconColor: "var(--brand)",
  },
  error: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderLeft: "3px solid var(--error-text)",
    iconColor: "var(--error-text)",
  },
  info: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderLeft: "3px solid var(--info-text)",
    iconColor: "var(--info-text)",
  },
};

export function Toast({ message, kind, onClose, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onClose]);

  const s = STYLES[kind];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        minWidth: 280,
        maxWidth: 420,
        background: s.background,
        border: s.border,
        borderLeft: s.borderLeft,
        borderRadius: 10,
        padding: "12px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.25s ease, opacity 0.25s ease",
      }}
    >
      {/* Icon */}
      <span style={{ color: s.iconColor, flexShrink: 0, marginTop: 1 }}>{ICONS[kind]}</span>

      {/* Message */}
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", flex: 1, lineHeight: 1.5 }}>{message}</p>

      {/* Close */}
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: 2,
          flexShrink: 0,
          lineHeight: 1,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
