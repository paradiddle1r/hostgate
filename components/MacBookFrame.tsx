"use client";

import { ReactNode } from "react";

/**
 * MacBook Pro-inspired frame — pure CSS, no images.
 * Proportions match Apple's product photography:
 *   - Thin black bezels with rounded corners
 *   - Aluminum silver lid wrapping the screen
 *   - Small camera notch (proportional)
 *   - Hinge bar + bottom base extending slightly wider than the lid
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
      {/* Aluminum lid */}
      <div className="relative rounded-[14px] bg-gradient-to-b from-[#e5e7eb] via-[#d1d5db] to-[#c8ccd1] p-[6px]">
        {/* Black bezel + screen */}
        <div className="relative overflow-hidden rounded-[9px] bg-black">
          {/* Camera notch — small, proportional (about 18% of screen width) */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-30 flex h-[14px] w-[18%] max-w-[120px] -translate-x-1/2 items-end justify-center rounded-b-[8px] bg-black">
            <span className="mb-[4px] h-[4px] w-[4px] rounded-full bg-[#1a1a1a] ring-[1px] ring-[#2a2a2a]" />
          </div>

          {/* Screen content */}
          <div className="relative z-10 aspect-[16/10] w-full bg-white">{children}</div>

          {/* Subtle top reflection */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[30%] bg-gradient-to-b from-white/[0.04] to-transparent" />
        </div>
      </div>

      {/* Hinge bar (lid bottom) — slightly darker aluminum */}
      <div className="relative mx-auto h-[10px] w-[101%] -translate-x-[0.5%] rounded-b-[3px] bg-gradient-to-b from-[#b5b9be] to-[#9ea3a8]">
        {/* Hinge dimple in the middle */}
        <div className="absolute left-1/2 top-0 h-[4px] w-[14%] -translate-x-1/2 rounded-b-md bg-gradient-to-b from-black/15 to-transparent" />
      </div>

      {/* Base (chassis extending wider) */}
      <div className="mx-auto h-[5px] w-[105%] -translate-x-[2.5%] rounded-b-[8px] bg-gradient-to-b from-[#a8acb1] to-[#8d9196]" />

      {/* Shadow beneath base */}
      <div className="pointer-events-none mx-auto h-[12px] w-[95%] -translate-y-1 rounded-[50%] bg-black/15 blur-md" />
    </div>
  );
}
