"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

// Loose client-side format check only — visual feedback, not validation logic.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Backend requires at least 8 chars (plus Identity complexity rules).
const MIN_PASSWORD = 8;

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Error styling shows as soon as a non-empty email looks malformed.
  const emailError =
    email.length > 0 && !EMAIL_RE.test(email) ? "সঠিক email দাও" : null;
  const valid =
    name.trim() !== "" &&
    username.trim() !== "" &&
    EMAIL_RE.test(email) &&
    password.length >= MIN_PASSWORD;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await register({
        email: email.trim(),
        // handle and email are distinct; store the handle bare (displayed as @handle).
        handle: username.trim().replace(/^@+/, ""),
        displayName: name.trim(),
        password,
      });
      router.push("/");
    } catch (err) {
      // 400 → server validation (e.g. duplicate handle/email, weak password).
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong. Try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-[31px] font-extrabold leading-[1.15] tracking-[-0.02em] text-text">
        Account তৈরি করো
      </h1>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5" noValidate>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <TextField
          label="Username"
          prefix="@"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        {formError && (
          <p className="text-[14px] text-error" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" disabled={!valid || submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-[26px] text-[15px] text-text-secondary">
        আগে থেকেই account আছে?{" "}
        <Link href="/login" className="font-bold text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
