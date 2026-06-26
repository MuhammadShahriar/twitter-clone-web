"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { QuotedTweet, Tweet } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { QuoteComposerModal } from "@/components/QuoteComposerModal";

interface QuoteComposerContextValue {
  /**
   * Open the quote composer for `quoted`. Any TweetCard / FocusedTweet calls this
   * from the "Quote" menu entry. No-ops with a toast when signed out (mirrors the
   * engagement actions' auth gate).
   */
  openQuote: (quoted: QuotedTweet) => void;
  /**
   * Subscribe to quote tweets created via the modal. The home Feed registers a
   * prepend handler so a fresh quote lands at the top of the timeline (mirrors
   * NotificationsContext.onNotification). Returns an unsubscribe fn.
   */
  onTweetPosted: (cb: (tweet: Tweet) => void) => () => void;
}

const QuoteComposerContext = createContext<QuoteComposerContextValue | null>(null);

/**
 * Owns the app-wide quote composer (Module 10B). Mounted once in the (app) shell
 * so the modal can be opened from any tweet (feed, detail, profile, search) and
 * renders above the column. Sits inside ToastProvider/AuthProvider so it can gate
 * on auth and surface a toast.
 */
export function QuoteComposerProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [target, setTarget] = useState<QuotedTweet | null>(null);

  // Feed(s) that want freshly-posted quotes prepended register here.
  const listenersRef = useRef<Set<(tweet: Tweet) => void>>(new Set());

  const openQuote = useCallback(
    (quoted: QuotedTweet) => {
      if (!isAuthenticated) {
        showToast("Sign in to quote posts.");
        return;
      }
      setTarget(quoted);
    },
    [isAuthenticated, showToast]
  );

  const onTweetPosted = useCallback((cb: (tweet: Tweet) => void) => {
    const set = listenersRef.current;
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }, []);

  const handlePosted = useCallback((tweet: Tweet) => {
    listenersRef.current.forEach((cb) => cb(tweet));
  }, []);

  const value = useMemo<QuoteComposerContextValue>(
    () => ({ openQuote, onTweetPosted }),
    [openQuote, onTweetPosted]
  );

  return (
    <QuoteComposerContext.Provider value={value}>
      {children}
      {target && (
        <QuoteComposerModal
          quoted={target}
          onPosted={handlePosted}
          onClose={() => setTarget(null)}
        />
      )}
    </QuoteComposerContext.Provider>
  );
}

export function useQuoteComposer(): QuoteComposerContextValue {
  const ctx = useContext(QuoteComposerContext);
  if (!ctx) {
    throw new Error("useQuoteComposer must be used within a QuoteComposerProvider");
  }
  return ctx;
}
