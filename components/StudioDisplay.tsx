"use client";

import { ReactNode } from "react";

/**
 * Apple Studio Display-inspired frame — pure CSS.
 * - Thin black bezel around a 16:9 screen
 * - Aluminum frame edge
 * - Aluminum stand with arm + base (proportional via aspect-ratio)
 */
export default function StudioDisplay({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full device-shadow ${className}`}>
      {/* Aluminum outer frame */}
      <div className="relative rounded-[14px] bg-gradient-to-b from-[#d4d4d8] via-[#a1a1aa] to-[#71717a] p-[3px]">
        {/* Inner black bezel */}
        <div className="relative overflow-hidden rounded-[11px] bg-black p-[10px]">
          {/* Screen (16:9) */}
          <div className="relative overflow-hidden rounded-[2px] bg-white">
            <div className="aspect-[16/9] w-full bg-white">{children}</div>
            {/* Subtle top reflection */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[25%] bg-gradient-to-b from-white/[0.04] to-transparent" />
          </div>
        </div>
      </div>

      {/* Aluminum stand — arm. Each piece keeps its own light-to-dark
          gradient so the arm and base read as two distinct components.
          The only change vs original: no rounded-b-* on the arm, so the
          joint with the base is a clean square junction. */}
      <div
        className="relative mx-auto mt-[2px] w-[26%] bg-gradient-to-b from-[#a1a1aa] via-[#8d9196] to-[#71717a]"
        style={{ aspectRatio: "26 / 6" }}
      />

      {/* Stand base — independent gradient (own highlight at the top). */}
      <div
        className="relative mx-auto w-[42%] rounded-b-[8px] bg-gradient-to-b from-[#a1a1aa] via-[#71717a] to-[#52525b]"
        style={{ aspectRatio: "42 / 3.5" }}
      />

      {/* Soft floor shadow */}
      <div
        className="pointer-events-none mx-auto w-[60%] -translate-y-2 rounded-[50%] bg-black/15 blur-md"
        style={{ aspectRatio: "60 / 3" }}
      />
    </div>
  );
}
