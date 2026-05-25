"use client";

import { ReactNode } from "react";

/**
 * MacBook Pro "Space Black" frame — black aluminum, pure CSS.
 * Proportions match Apple's product photography:
 *   - Thin black bezels with rounded corners
 *   - Black aluminum lid (Space Black)
 *   - Small camera notch (~18% of screen width)
 *   - Hinge bar + base extending slightly wider
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
      {/* Space Black aluminum lid */}
      <div className="relative rounded-[14px] bg-gradient-to-b from-[#2a2a2c] via-[#1c1c1e] to-[#0d0d0f] p-[6px]">
        {/* Inner black bezel + screen */}
        <div className="relative overflow-hidden rounded-[9px] bg-black">
          {/* Camera notch — proportional, blends with bezel */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-30 flex h-[14px] w-[18%] max-w-[120px] -translate-x-1/2 items-end justify-center rounded-b-[8px] bg-black">
            <span className="mb-[4px] h-[4px] w-[4px] rounded-full bg-[#1a1a1a] ring-[1px] ring-[#2a2a2a]" />
          </div>

          {/* Screen content */}
          <div className="relative z-10 aspect-[16/10] w-full bg-white">{children}</div>

          {/* Subtle top reflection */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[30%] bg-gradient-to-b from-white/[0.04] to-transparent" />
        </div>
      </div>

      {/* Hinge bar — slightly darker than lid */}
      <div className="relative mx-auto h-[10px] w-[101%] -translate-x-[0.5%] rounded-b-[3px] bg-gradient-to-b from-[#1a1a1c] to-[#0a0a0c]">
        <div className="absolute left-1/2 top-0 h-[4px] w-[14%] -translate-x-1/2 rounded-b-md bg-gradient-to-b from-black/40 to-transparent" />
      </div>

      {/* Base extending wider */}
      <div className="mx-auto h-[5px] w-[105%] -translate-x-[2.5%] rounded-b-[8px] bg-gradient-to-b from-[#171719] to-[#08080a]" />

      {/* Shadow beneath */}
      <div className="pointer-events-none mx-auto h-[12px] w-[95%] -translate-y-1 rounded-[50%] bg-black/20 blur-md" />
    </div>
  );
}
