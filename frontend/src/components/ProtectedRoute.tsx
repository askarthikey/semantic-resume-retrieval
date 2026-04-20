import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100">
        <p className="text-sm font-semibold text-slate-600">Checking session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
