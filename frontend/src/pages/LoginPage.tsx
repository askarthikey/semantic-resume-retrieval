import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { getApiErrorMessage } from "../api/client";
import { Toast } from "../components/Toast";
import { useAuth } from "../contexts/AuthContext";

type Mode = "login" | "register";

export function LoginPage() {
  const { isAuthenticated, loginWithPassword, registerWithPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error" | "info"; message: string } | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/upload" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await loginWithPassword(email, password);
      } else {
        await registerWithPassword(email, password);
      }
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-overlay)",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    color: "var(--text-primary)",
    padding: "10px 14px",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        background: "var(--bg-base)",
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--brand)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Resume Studio
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Semantic candidate retrieval
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            padding: "28px 28px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
          }}
        >
          {/* Mode tabs */}
          <div
            style={{
              display: "flex",
              gap: 0,
              background: "var(--bg-overlay)",
              borderRadius: 8,
              padding: 3,
              marginBottom: 24,
            }}
          >
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                  background: mode === m ? "var(--bg-surface)" : "transparent",
                  color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                }}
              >
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={inputStyle}
                onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--brand)")}
                onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border-default)")}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Password
              </label>
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={inputStyle}
                onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--brand)")}
                onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border-default)")}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "11px 0",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                border: "none",
                cursor: busy ? "not-allowed" : "pointer",
                background: busy ? "var(--bg-subtle)" : "var(--brand)",
                color: busy ? "var(--text-muted)" : "var(--text-inverse)",
                transition: "background 0.15s",
                letterSpacing: "-0.01em",
              }}
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
          Secure, workspace-isolated resume operations.
        </p>
      </div>

      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
