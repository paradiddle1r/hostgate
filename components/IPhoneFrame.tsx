"use client";

import { ReactNode } from "react";

/**
 * iPhone 15 Pro-inspired frame — pure CSS, fully responsive.
 *
 * Sizing strategy:
 *   - All inner elements (notch, frame, buttons) use % values relative to
 *     the device width, so the device looks correct at any size.
 *   - Use `style.width` (px) via wrapper, or `w-full max-w-[Xpx]`.
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
      <div className="relative rounded-[18%] bg-gradient-to-br from-[#d4d4d8] via-[#a1a1aa] to-[#71717a] p-[1.1%]">
        {/* Mid-frame dark bezel */}
        <div className="relative rounded-[17%] bg-gradient-to-b from-[#3f3f46] to-[#18181b] p-[0.7%]">
          {/* Inner black bezel */}
          <div className="relative rounded-[16%] bg-black p-[2.6%]">
            {/* Screen */}
            <div className="relative overflow-hidden rounded-[14%] bg-white">
              {/* Dynamic Island — ~28% of screen width */}
              <div className="pointer-events-none absolute left-1/2 top-[2%] z-30 h-[3.5%] w-[28%] -translate-x-1/2 rounded-full bg-black" />

              {/* Status bar */}
              <div className="relative z-20 flex h-[5.5%] items-center justify-between px-[8%] pt-[1%] text-[10px] font-semibold text-zinc-900">
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
              <div className="pointer-events-none absolute inset-x-0 bottom-[1%] z-30 flex justify-center">
                <span className="h-[0.6%] min-h-[3px] w-[36%] rounded-full bg-zinc-900" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side buttons — percentage positioning so they stay in proportion */}
      <span className="absolute -left-[1%] top-[16%] h-[5%] w-[1%] min-w-[2px] rounded-l-sm bg-gradient-to-r from-[#71717a] to-[#a1a1aa]" />
      <span className="absolute -left-[1%] top-[23%] h-[7%] w-[1%] min-w-[2px] rounded-l-sm bg-gradient-to-r from-[#71717a] to-[#a1a1aa]" />
      <span className="absolute -left-[1%] top-[32%] h-[7%] w-[1%] min-w-[2px] rounded-l-sm bg-gradient-to-r from-[#71717a] to-[#a1a1aa]" />
      <span className="absolute -right-[1%] top-[20.5%] h-[10.5%] w-[1%] min-w-[2px] rounded-r-sm bg-gradient-to-l from-[#71717a] to-[#a1a1aa]" />
    </div>
  );
}
