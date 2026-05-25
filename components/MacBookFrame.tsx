"use client";

import { ReactNode } from "react";

/**
 * MacBook Pro 14"-inspired frame — pure CSS/SVG, no images.
 * Refined proportions, multi-layer shadow, accurate notch.
 */
export default function MacBookFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full device-shadow ${className}`}>
      {/* Outer aluminum lid */}
      <div className="relative rounded-[20px] bg-gradient-to-b from-zinc-200 to-zinc-300 p-[10px]">
        {/* Inner screen bezel */}
        <div className="relative overflow-hidden rounded-[12px] bg-black">
          {/* Camera notch */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-30 flex h-[18px] w-[140px] -translate-x-1/2 items-center justify-center rounded-b-[10px] bg-black">
            <span className="h-[6px] w-[6px] rounded-full bg-zinc-700 ring-1 ring-zinc-900/80" />
          </div>
          {/* Screen reflection top */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/3 bg-gradient-to-b from-white/[0.03] to-transparent" />
          {/* Screen content */}
          <div className="relative z-10 aspect-[16/10] w-full bg-white">{children}</div>
        </div>
      </div>

      {/* Lid bottom (hinge area) */}
      <div className="relative mx-auto -mt-[1px] h-[12px] w-[101%] -translate-x-[0.5%] rounded-b-[4px] bg-gradient-to-b from-zinc-300 via-zinc-300 to-zinc-200">
        <div className="absolute left-1/2 top-0 h-[5px] w-[16%] -translate-x-1/2 rounded-b-md bg-gradient-to-b from-zinc-400/40 to-transparent" />
      </div>

      {/* Base extending beyond lid */}
      <div className="mx-auto h-[6px] w-[103%] -translate-x-[1.5%] rounded-b-[6px] bg-gradient-to-b from-zinc-200 to-zinc-100 shadow-[0_4px_12px_rgba(0,0,0,0.06)]" />
    </div>
  );
}
