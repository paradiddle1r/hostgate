"use client";

import { ReactNode } from "react";

/**
 * Apple Studio Display-inspired frame — pure CSS.
 * - Thin black bezel around a 16:9 screen
 * - Aluminum frame edge
 * - Aluminum stand with arm + base
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

          {/* Apple logo at bottom center */}
          <div className="flex items-center justify-center pt-2 pb-[1px]">
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-zinc-500" fill="currentColor">
              <path d="M17.6 13.8c0-2.5 2-3.7 2.1-3.7-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.2 10.3.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5.6-.8.9-1.6 1.2-2.4-2.6-1-2.8-3.8-2.8-3.9zM15.1 6.6c.7-.8 1.2-2 1.1-3.1-1 .1-2.2.7-2.9 1.5-.7.7-1.3 1.9-1.1 3.1 1.1.1 2.2-.6 2.9-1.5z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Aluminum stand — arm */}
      <div className="relative mx-auto mt-[2px] h-[30px] w-[26%] rounded-b-md bg-gradient-to-b from-[#a1a1aa] via-[#8d9196] to-[#71717a]">
        {/* Subtle highlight on the arm */}
        <div className="absolute left-1/2 top-0 h-full w-[1px] -translate-x-1/2 bg-white/20" />
      </div>

      {/* Stand base */}
      <div className="relative mx-auto h-[10px] w-[42%] rounded-b-[8px] bg-gradient-to-b from-[#a1a1aa] via-[#71717a] to-[#52525b]">
        {/* Front highlight */}
        <div className="absolute inset-x-2 top-0 h-[1px] bg-white/20" />
      </div>

      {/* Soft floor shadow */}
      <div className="pointer-events-none mx-auto h-[12px] w-[60%] -translate-y-2 rounded-[50%] bg-black/15 blur-md" />
    </div>
  );
}
