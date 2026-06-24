"use client";

import { useEffect, useState } from "react";
import { getSuggestions, type UserSuggestion } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/**
 * Fetch "who to follow" suggestions once the auth bootstrap resolves (Module
 * 3D). Anonymous users get an empty list (the endpoint is [Authorize]); errors
 * resolve to empty so callers can simply hide the card. Shared by the sidebar
 * and the Following empty-state.
 */
export function useSuggestions(limit = 3) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- intentional fetch-on-mount loading/state sync */
    if (!isAuthenticated) {
      // Clear any stale suggestions when logging out; the endpoint is [Authorize].
      setUsers([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    getSuggestions(limit)
      .then((u) => active && setUsers(u))
      .catch(() => active && setUsers([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, limit]);

  return { users, loading: loading || authLoading, isAuthenticated };
}
