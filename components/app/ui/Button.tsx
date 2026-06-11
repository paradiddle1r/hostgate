"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "./Spinner";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium " +
  "transition-colors duration-150 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--app-accent)] text-[var(--app-accent-fg)] " +
    "hover:brightness-110 active:brightness-95 shadow-sm",
  ghost:
    "border border-[var(--app-border)] bg-transparent text-[var(--app-fg)] " +
    "hover:bg-[var(--app-surface-2)]",
  danger:
    "bg-[var(--app-danger)] text-white hover:brightness-110 active:brightness-95 shadow-sm",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
});

export default Button;
