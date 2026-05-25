"use client";

import { ReactNode } from "react";
import { useReveal } from "@/lib/useReveal";

type Variant = "fade" | "scale" | "stagger";

/**
 * Wraps children in a div that animates when scrolled into view.
 */
export default function Reveal({
  children,
  variant = "fade",
  className = "",
  delay,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  delay?: number; // ms
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const variantClass =
    variant === "scale" ? "scale-up" : variant === "stagger" ? "stagger" : "fade-up";
  const style = delay ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <div
      ref={ref}
      style={style}
      className={`${variantClass} ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
