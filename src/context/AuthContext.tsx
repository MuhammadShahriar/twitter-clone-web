"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as api from "@/lib/api";
import type { AuthSession, RegisterInput } from "@/lib/api";

export interface AuthUser {
  id: string;
  handle: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the initial refresh-cookie bootstrap resolves. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromSession(session: AuthSession): AuthUser {
  return {
    id: session.userId,
    handle: session.handle,
    displayName: session.displayName,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // If a silent refresh inside fetchWithAuth fails, drop the UI to logged-out.
  useEffect(() => {
    api.setAuthLostHandler(() => setUser(null));
    return () => api.setAuthLostHandler(null);
  }, []);

  // Bootstrap on mount: the in-memory token is gone after a reload, so try the
  // refresh cookie once. Success → logged in; 401 → stay logged out.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await api.refresh();
        if (active) setUser(userFromSession(session));
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    setUser(userFromSession(session));
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    await api.register(input);
    // Auto-login so the new account lands authenticated (also sets the cookie).
    const session = await api.login(input.email, input.password);
    setUser(userFromSession(session));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
