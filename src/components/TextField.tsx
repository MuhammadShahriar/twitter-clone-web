"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  /** Error message; truthy also drives the red error styling + warning icon. */
  error?: string | null;
  /** Inline affordance shown inside the input, e.g. "@" for a handle. */
  prefix?: string;
};

// Floating-label input: the label sits inside the field and rises to a small
// caption once the field is focused or filled (matches the locked auth design).
export function TextField({
  label,
  error,
  prefix,
  type = "text",
  value,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;
  const invalid = Boolean(error);
  const hasValue =
    value !== undefined && value !== null && String(value).length > 0;
  const floated = focused || hasValue;

  const labelColor = invalid
    ? "text-error"
    : focused
      ? "text-accent"
      : "text-text-secondary";
  const borderColor = invalid
    ? "border-error"
    : focused
      ? "border-accent"
      : "border-border";

  return (
    <div>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-[15px] top-[26px] text-[17px] text-text-secondary">
            {prefix}
          </span>
        )}

        <input
          id={id}
          type={inputType}
          value={value}
          placeholder=" "
          aria-invalid={invalid}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={[
            "h-14 w-full rounded-lg border bg-surface pb-1.5 pt-[22px] text-[17px] text-text outline-none transition-colors",
            prefix ? "pl-7" : "pl-3.5",
            isPassword ? "pr-12" : "pr-3.5",
            borderColor,
          ].join(" ")}
          {...props}
        />

        <label
          htmlFor={id}
          className={[
            "pointer-events-none absolute transition-all duration-150",
            prefix ? "left-7" : "left-[15px]",
            floated ? "top-[9px] text-[12px]" : "top-[26px] text-[17px]",
            labelColor,
          ].join(" ")}
        >
          {label}
        </label>

        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-full text-text-secondary transition-colors hover:bg-[rgba(29,155,240,0.1)] hover:text-accent"
          >
            <EyeIcon off={show} />
          </button>
        )}
      </div>

      {invalid && (
        <div className="mx-1 mt-1.5 flex items-center gap-1.5 text-[13px] text-error">
          <WarnIcon />
          {error}
        </div>
      )}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c5.5 0 9 5.5 9 7a12.3 12.3 0 0 1-2.2 3" />
          <path d="M6.6 6.6A12.4 12.4 0 0 0 3 12c0 1.5 3.5 7 9 7a10.6 10.6 0 0 0 4-.8" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
