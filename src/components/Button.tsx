import type { ButtonHTMLAttributes } from "react";

// Fully-rounded pill, bold, full width. Dims to 50% when disabled.
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`h-13 w-full rounded-full bg-accent text-[17px] font-extrabold text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-accent ${className}`}
      {...props}
    />
  );
}
