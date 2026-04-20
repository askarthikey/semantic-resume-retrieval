import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { login, me, register } from "../api/auth";
import { setAuthToken, setUnauthorizedHandler } from "../api/client";
import type { UserProfile } from "../api/types";

const TOKEN_KEY = "auth_token";

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  initializing: boolean;
  isAuthenticated: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    setAuthToken(token);
    if (!token) {
      setUser(null);
      setInitializing(false);
      return;
    }

    let alive = true;
    void me()
      .then((profile) => {
        if (!alive) return;
        setUser(profile);
      })
      .catch(() => {
        if (!alive) return;
        logout();
      })
      .finally(() => {
        if (!alive) return;
        setInitializing(false);
      });

    return () => {
      alive = false;
    };
  }, [token, logout]);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const response = await login({ email, password });
    localStorage.setItem(TOKEN_KEY, response.access_token);
    setAuthToken(response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  }, []);

  const registerWithPassword = useCallback(async (email: string, password: string) => {
    const response = await register({ email, password });
    localStorage.setItem(TOKEN_KEY, response.access_token);
    setAuthToken(response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initializing,
      isAuthenticated: Boolean(token && user),
      loginWithPassword,
      registerWithPassword,
      logout,
    }),
    [initializing, loginWithPassword, logout, registerWithPassword, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
