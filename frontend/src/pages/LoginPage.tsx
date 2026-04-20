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
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

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
      setToast({ kind: "success", message: mode === "login" ? "Welcome back." : "Account created." });
    } catch (error) {
      setToast({ kind: "error", message: getApiErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_15%,#dbeafe_0%,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <p className="text-xs uppercase tracking-[0.18em] text-sky-600">Recruiter Studio</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{mode === "login" ? "Sign in" : "Create account"}</h1>
        <p className="mt-2 text-sm text-slate-600">Secure access for workspace-isolated resume operations.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 outline-none ring-sky-500 transition focus:ring"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Password</span>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 outline-none ring-sky-500 transition focus:ring"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
          className="mt-4 text-sm font-semibold text-sky-700 hover:text-sky-800"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </section>

      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
