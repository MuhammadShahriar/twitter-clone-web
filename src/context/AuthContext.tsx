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
  /** Current user's avatar (Module 4C); null when unset. */
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the initial refresh-cookie bootstrap resolves. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Patch the signed-in user after a profile edit (4C) so chips update live. */
  updateCurrentUser: (patch: Partial<Pick<AuthUser, "displayName" | "avatarUrl">>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromSession(session: AuthSession): AuthUser {
  return {
    id: session.userId,
    handle: session.handle,
    displayName: session.displayName,
    avatarUrl: null, // session payload has no avatar; getMe enriches it
  };
}

function userFromCurrent(me: api.CurrentUser): AuthUser {
  return {
    id: me.userId,
    handle: me.handle,
    displayName: me.displayName,
    avatarUrl: me.avatarUrl,
  };
}

// After login/refresh sets the access token, getMe carries avatarUrl; fall back
// to the (avatar-less) session user if that enrichment call fails.
async function enrich(session: AuthSession): Promise<AuthUser> {
  try {
    return userFromCurrent(await api.getMe());
  } catch {
    return userFromSession(session);
  }
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
        const u = await enrich(session);
        if (active) setUser(u);
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
    setUser(await enrich(session));
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    await api.register(input);
    // Auto-login so the new account lands authenticated (also sets the cookie).
    const session = await api.login(input.email, input.password);
    setUser(await enrich(session));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const updateCurrentUser = useCallback(
    (patch: Partial<Pick<AuthUser, "displayName" | "avatarUrl">>) => {
      setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
      updateCurrentUser,
    }),
    [user, isLoading, login, register, logout, updateCurrentUser]
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
