"use client";

import { ReactNode } from "react";

/**
 * MacBook Pro-inspired frame — pure CSS/SVG, no images.
 * Renders any ReactNode as the "screen content".
 */
export default function MacBookFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto w-full ${className}`}>
      {/* Lid + screen */}
      <div className="relative rounded-[18px] border border-zinc-300 bg-zinc-200 p-[10px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.18)]">
        <div className="relative overflow-hidden rounded-[10px] bg-black">
          {/* Camera notch */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 flex h-[14px] w-[110px] -translate-x-1/2 items-center justify-center rounded-b-xl bg-black">
            <span className="h-[5px] w-[5px] rounded-full bg-zinc-700 ring-1 ring-zinc-800" />
          </div>
          {/* Screen content area */}
          <div className="aspect-[16/10] w-full bg-white">{children}</div>
        </div>
      </div>

      {/* Base / chassis */}
      <div className="relative mx-auto -mt-[2px] h-[14px] w-full max-w-[105%] rounded-b-[14px] bg-gradient-to-b from-zinc-300 to-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
        {/* Hinge dimple */}
        <div className="absolute left-1/2 top-0 h-[6px] w-[18%] -translate-x-1/2 rounded-b-md bg-gradient-to-b from-zinc-400/60 to-transparent" />
      </div>

      {/* Reflection on screen */}
      <div className="pointer-events-none absolute inset-x-[10px] top-[10px] h-1/2 rounded-t-[10px] bg-gradient-to-b from-white/[0.06] to-transparent" />
    </div>
  );
}
