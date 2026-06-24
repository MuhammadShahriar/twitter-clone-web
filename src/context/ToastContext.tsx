"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ToastContextValue {
  /** Show a brief, auto-dismissing message at the bottom of the screen. */
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 3000;

/**
 * Minimal toast for subtle, transient feedback (Module 3C) — e.g. a failed
 * like reverting, or a "sign in to like" prompt. One message at a time; a new
 * message replaces the current one and resets the timer. No dependencies.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div className="toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
