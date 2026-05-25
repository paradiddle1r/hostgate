"use client";

import { ReactNode } from "react";

/**
 * iPhone 15 Pro-inspired frame — pure CSS, no images.
 * Renders any ReactNode as the "screen content".
 */
export default function IPhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full max-w-[280px] ${className}`}>
      {/* Outer titanium frame */}
      <div className="relative rounded-[44px] bg-gradient-to-b from-zinc-300 to-zinc-400 p-[3px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)]">
        {/* Inner bezel */}
        <div className="relative rounded-[42px] bg-black p-[8px]">
          {/* Screen */}
          <div className="relative overflow-hidden rounded-[34px] bg-white">
            {/* Dynamic Island */}
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
            {/* Status bar */}
            <div className="relative z-10 flex h-[34px] items-center justify-between px-6 pt-2 text-[10px] font-semibold text-zinc-900">
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <span className="inline-block">●●●●</span>
                <span className="inline-block">📶</span>
                <span className="inline-block">🔋</span>
              </span>
            </div>
            {/* Aspect ratio container (iPhone is ~19.5:9) */}
            <div className="aspect-[9/19.5] w-full bg-white">
              {children}
            </div>
            {/* Home indicator */}
            <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-20 flex justify-center">
              <span className="h-[5px] w-[100px] rounded-full bg-zinc-900" />
            </div>
          </div>
        </div>
      </div>

      {/* Side buttons */}
      <span className="absolute -left-[2px] top-[100px] h-[28px] w-[2px] rounded-l-sm bg-zinc-400" />
      <span className="absolute -left-[2px] top-[145px] h-[40px] w-[2px] rounded-l-sm bg-zinc-400" />
      <span className="absolute -left-[2px] top-[200px] h-[40px] w-[2px] rounded-l-sm bg-zinc-400" />
      <span className="absolute -right-[2px] top-[130px] h-[60px] w-[2px] rounded-r-sm bg-zinc-400" />
    </div>
  );
}
