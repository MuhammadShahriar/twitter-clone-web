"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const valid = identifier.trim() !== "" && password.length >= 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await login(identifier.trim(), password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // "login" (not "email") since the identifier can be an email or a handle.
        setFormError("Invalid login or password.");
      } else if (err instanceof ApiError && err.status === 423) {
        setFormError("Too many attempts. Please try again later.");
      } else {
        setFormError(
          err instanceof Error ? err.message : "Something went wrong. Try again."
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-[31px] font-extrabold leading-[1.15] tracking-[-0.02em] text-text">
        Sign in
      </h1>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5" noValidate>
        <TextField
          label="Email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {formError && (
          <p className="text-[14px] text-error" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" disabled={!valid || submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* No password-reset flow exists yet, so this is deliberately NOT a link
          (a dead href="#" is a worse a11y/UX lie). Shown as a muted, honest hint
          with a tooltip rather than a control that goes nowhere. */}
      <span
        className="mt-3.5 inline-block cursor-default text-[14px] text-text-secondary"
        title="Password reset isn't available yet."
      >
        Password ভুলে গেছো?
      </span>

      <p className="mt-[26px] text-[15px] text-text-secondary">
        Account নেই?{" "}
        <Link href="/register" className="font-bold text-accent hover:underline">
          Create account
        </Link>
      </p>
    </AuthShell>
  );
}
