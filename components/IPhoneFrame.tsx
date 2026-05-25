"use client";

import { ReactNode } from "react";

/**
 * iPhone 15 Pro-inspired frame — pure CSS, no images.
 * Refined titanium frame, accurate Dynamic Island, home indicator.
 */
export default function IPhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full max-w-[280px] device-shadow ${className}`}>
      {/* Titanium outer frame */}
      <div className="relative rounded-[50px] bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 p-[4px]">
        {/* Mid-frame inner shadow */}
        <div className="relative rounded-[46px] bg-gradient-to-b from-zinc-700 to-black p-[2px]">
          {/* Inner bezel */}
          <div className="relative rounded-[44px] bg-black p-[8px]">
            {/* Screen */}
            <div className="relative overflow-hidden rounded-[36px] bg-white">
              {/* Dynamic Island */}
              <div className="pointer-events-none absolute left-1/2 top-2 z-30 flex h-[28px] w-[110px] -translate-x-1/2 items-center justify-center rounded-full bg-black">
                <span className="absolute right-3 h-[7px] w-[7px] rounded-full bg-zinc-800 ring-[1.5px] ring-zinc-900/60" />
              </div>

              {/* Status bar */}
              <div className="relative z-20 flex h-[36px] items-center justify-between px-7 pt-2 text-[10px] font-semibold text-zinc-900">
                <span>9:41</span>
                <span className="flex items-center gap-1.5">
                  {/* Signal */}
                  <svg viewBox="0 0 16 10" className="h-2.5 w-3.5" fill="currentColor">
                    <rect x="0" y="6" width="2" height="4" rx="0.5" />
                    <rect x="3" y="4" width="2" height="6" rx="0.5" />
                    <rect x="6" y="2" width="2" height="8" rx="0.5" />
                    <rect x="9" y="0" width="2" height="10" rx="0.5" />
                  </svg>
                  {/* WiFi */}
                  <svg viewBox="0 0 16 12" className="h-3 w-3.5" fill="currentColor">
                    <path d="M8 0a14 14 0 00-8 3l2 2a11 11 0 0112 0l2-2a14 14 0 00-8-3zm0 4a8 8 0 00-5 2l2 2a5 5 0 016 0l2-2a8 8 0 00-5-2zm0 4a3 3 0 00-2 1l2 2 2-2a3 3 0 00-2-1z" />
                  </svg>
                  {/* Battery */}
                  <svg viewBox="0 0 26 12" className="h-2.5 w-6" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" />
                    <rect x="2" y="2" width="14" height="8" rx="1" fill="currentColor" />
                    <rect x="23" y="4" width="2" height="4" rx="0.5" fill="currentColor" />
                  </svg>
                </span>
              </div>

              {/* App content area */}
              <div className="aspect-[9/19.5] w-full bg-white">{children}</div>

              {/* Home indicator */}
              <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-30 flex justify-center">
                <span className="h-[5px] w-[110px] rounded-full bg-zinc-900" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side buttons — refined */}
      <span className="absolute -left-[3px] top-[100px] h-[32px] w-[3px] rounded-l-md bg-gradient-to-r from-zinc-500 to-zinc-300" />
      <span className="absolute -left-[3px] top-[148px] h-[44px] w-[3px] rounded-l-md bg-gradient-to-r from-zinc-500 to-zinc-300" />
      <span className="absolute -left-[3px] top-[208px] h-[44px] w-[3px] rounded-l-md bg-gradient-to-r from-zinc-500 to-zinc-300" />
      <span className="absolute -right-[3px] top-[130px] h-[68px] w-[3px] rounded-r-md bg-gradient-to-l from-zinc-500 to-zinc-300" />
    </div>
  );
}
