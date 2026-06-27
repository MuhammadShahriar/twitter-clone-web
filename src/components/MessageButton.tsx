"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateConversation } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

/**
 * Profile "Message" button (Module 12) — the primary way to start a DM. Get-or-
 * creates the 1-on-1 conversation with `handle` then opens its thread. Auth-gated
 * (routes to /login when signed out). Shown only on other people's profiles.
 */
export function MessageButton({ handle }: { handle: string }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);

  async function start() {
    if (starting) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setStarting(true);
    try {
      const conv = await getOrCreateConversation(handle);
      router.push(`/messages/${conv.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't start the conversation.");
      setStarting(false); // navigation unmounts on success; only reset on failure
    }
  }

  return (
    <button
      type="button"
      className="profile-btn message"
      onClick={start}
      disabled={starting}
      aria-label="Message"
    >
      {starting ? "Opening…" : "Message"}
    </button>
  );
}
