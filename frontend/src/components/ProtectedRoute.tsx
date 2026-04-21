import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--bg-base)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--brand)", animation: "spin 0.8s linear infinite" }} />
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Checking session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
