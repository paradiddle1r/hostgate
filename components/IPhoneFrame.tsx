"use client";

import { ReactNode } from "react";

/**
 * iPhone 15 Pro-inspired frame — pure CSS.
 *
 * Strategy: fixed-pixel border-radius and paddings so corners stay circular
 * (percentage radii would produce ovals on rectangular elements).
 * Side button positions use % of container height so they stay in proportion.
 *
 * Designed for widths ~180px – 280px.
 */
export default function IPhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full max-w-[260px] device-shadow ${className}`}>
      {/* Titanium outer frame */}
      <div className="relative rounded-[42px] bg-gradient-to-br from-[#d4d4d8] via-[#a1a1aa] to-[#71717a] p-[3px]">
        {/* Mid-frame dark bezel */}
        <div className="relative rounded-[40px] bg-gradient-to-b from-[#3f3f46] to-[#18181b] p-[2px]">
          {/* Inner black bezel */}
          <div className="relative rounded-[38px] bg-black p-[7px]">
            {/* Screen */}
            <div className="relative overflow-hidden rounded-[32px] bg-white">
              {/* Dynamic Island — ~28% width */}
              <div className="pointer-events-none absolute left-1/2 top-[7px] z-30 h-[20px] w-[28%] max-w-[76px] -translate-x-1/2 rounded-full bg-black" />

              {/* Status bar */}
              <div className="relative z-20 flex h-[30px] items-center justify-between px-6 pt-1 text-[10px] font-semibold text-zinc-900">
                <span>9:41</span>
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 16 10" className="h-2.5 w-3" fill="currentColor">
                    <rect x="0" y="6" width="2" height="4" rx="0.5" />
                    <rect x="3" y="4" width="2" height="6" rx="0.5" />
                    <rect x="6" y="2" width="2" height="8" rx="0.5" />
                    <rect x="9" y="0" width="2" height="10" rx="0.5" />
                  </svg>
                  <svg viewBox="0 0 16 12" className="h-2.5 w-3" fill="currentColor">
                    <path d="M8 0a14 14 0 00-8 3l2 2a11 11 0 0112 0l2-2a14 14 0 00-8-3zm0 4a8 8 0 00-5 2l2 2a5 5 0 016 0l2-2a8 8 0 00-5-2zm0 4a3 3 0 00-2 1l2 2 2-2a3 3 0 00-2-1z" />
                  </svg>
                  <svg viewBox="0 0 26 12" className="h-2.5 w-5" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" />
                    <rect x="2" y="2" width="14" height="8" rx="1" fill="currentColor" />
                    <rect x="23" y="4" width="2" height="4" rx="0.5" fill="currentColor" />
                  </svg>
                </span>
              </div>

              {/* App content */}
              <div className="aspect-[9/19.5] w-full bg-white">{children}</div>

              {/* Home indicator */}
              <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-30 flex justify-center">
                <span className="h-[4px] w-[90px] rounded-full bg-zinc-900" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side buttons — vertical position in %, width in px (so they keep a real button thickness) */}
      <span className="absolute -left-[2px] top-[16%] h-[5%] w-[2px] rounded-l-sm bg-gradient-to-r from-[#71717a] to-[#a1a1aa]" />
      <span className="absolute -left-[2px] top-[23%] h-[7%] w-[2px] rounded-l-sm bg-gradient-to-r from-[#71717a] to-[#a1a1aa]" />
      <span className="absolute -left-[2px] top-[32%] h-[7%] w-[2px] rounded-l-sm bg-gradient-to-r from-[#71717a] to-[#a1a1aa]" />
      <span className="absolute -right-[2px] top-[20.5%] h-[10.5%] w-[2px] rounded-r-sm bg-gradient-to-l from-[#71717a] to-[#a1a1aa]" />
    </div>
  );
}
