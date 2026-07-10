"use client";

import { ReactNode } from "react";

/**
 * iPhone 17 Pro frame — pure CSS, fully proportional.
 *
 * Geometry measured off Apple's own front-view renders (apple.com/iphone-17-pro
 * product viewer, silhouette circle-fit + island probe), modelled in device
 * points: display 440×956pt, metal rim 4.5pt, black bezel 11pt → body
 * 471×987pt. The Liquid-Glass generation is much rounder than the 15/16 era:
 * body corner R ≈ 97pt (~20.6% of width), display R ≈ 81pt, concentric.
 *
 * Everything is percentages / aspect-ratios / `x% / y%` radius pairs, so the
 * frame renders with identical proportions at ANY width — no fixed-pixel
 * values to drift when the layout shrinks.
 *
 * The scene (children) fills the screen edge-to-edge; the Dynamic Island,
 * status bar and home indicator are frame-owned overlays. The status-bar
 * time/icons are vertically centered on the island's centerline, like iOS.
 * Scenes read `--hg-safe-top` / `--hg-safe-bottom` (container units resolved
 * against the screen) to keep their content clear of the overlays.
 */
export default function IPhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full device-shadow ${className}`}>
      {/* Aluminum rim — 4.5pt of 471 */}
      <div
        className="relative bg-gradient-to-br from-[#e3e4e8] via-[#9fa2a9] to-[#585b62] p-[0.96%] shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]"
        style={{ borderRadius: "20.6% / 9.82%" }}
      >
        {/* Black bezel — 11pt of 462 */}
        <div
          className="relative bg-black p-[2.38%] shadow-[inset_0_0_1px_rgba(255,255,255,0.28)]"
          style={{ borderRadius: "20% / 9.45%" }}
        >
          {/* Screen — 440×956pt, the query container for scene sizing */}
          <div
            className="relative w-full overflow-hidden bg-white [container-type:inline-size]"
            style={{ aspectRatio: "440 / 956", borderRadius: "18.5% / 8.51%" }}
          >
            {/* Scene — edge-to-edge behind the island */}
            <div
              className="absolute inset-0"
              style={
                {
                  "--hg-safe-top": "14cqw",
                  "--hg-safe-bottom": "6cqw",
                } as React.CSSProperties
              }
            >
              {children}
            </div>

            {/* Status bar — items sit on the island's centerline (island
                center = 37.5pt of 956 ≈ 3.92%H, so the row is 7.84%H tall
                and its center matches). Time centers in the left segment
                beside the island, icons mirror on the right. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[7.84%] items-center justify-between text-zinc-900">
              <span className="flex w-[35%] justify-center pl-[4%] text-[3.9cqw] font-semibold tracking-[0.01em]">
                9:41
              </span>
              <span className="flex w-[35%] items-center justify-center gap-[1.3cqw] pr-[4%]">
                {/* cellular */}
                <svg viewBox="0 0 16 10" className="w-[4.3cqw]" fill="currentColor">
                  <rect x="0" y="6" width="2.6" height="4" rx="0.6" />
                  <rect x="4.2" y="4" width="2.6" height="6" rx="0.6" />
                  <rect x="8.4" y="2" width="2.6" height="8" rx="0.6" />
                  <rect x="12.6" y="0" width="2.6" height="10" rx="0.6" />
                </svg>
                {/* wifi */}
                <svg viewBox="0 0 16 11" className="w-[3.9cqw]" fill="currentColor">
                  <path d="M8 0C5 0 2.2 1.1 0 3l1.7 1.8A9.4 9.4 0 018 2.5c2.4 0 4.6.8 6.3 2.3L16 3c-2.2-1.9-5-3-8-3zm0 4.4c-1.8 0-3.5.7-4.8 1.9l1.7 1.8A4.6 4.6 0 018 6.9c1.2 0 2.3.4 3.1 1.2l1.7-1.8A6.9 6.9 0 008 4.4zM8 8.8c-.7 0-1.3.3-1.7.8L8 11l1.7-1.4c-.4-.5-1-.8-1.7-.8z" />
                </svg>
                {/* battery */}
                <svg viewBox="0 0 27 12" className="w-[6.4cqw]" fill="none">
                  <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" strokeOpacity="0.4" />
                  <rect x="2" y="2" width="16" height="8" rx="1.6" fill="currentColor" />
                  <path d="M24.5 4v4c1.2-.2 2-1 2-2s-.8-1.8-2-2z" fill="currentColor" fillOpacity="0.4" />
                </svg>
              </span>
            </div>

            {/* Dynamic Island — 130×40.6pt, 17.2pt from the top */}
            <div
              className="pointer-events-none absolute left-1/2 top-[1.8%] z-30 w-[29.5%] -translate-x-1/2 rounded-full bg-black"
              style={{ aspectRatio: "3.2" }}
            >
              {/* camera lens glint */}
              <span className="absolute right-[7%] top-1/2 h-[52%] -translate-y-1/2 rounded-full bg-[#0a0a12]" style={{ aspectRatio: "1" }}>
                <span className="absolute left-[28%] top-[22%] h-[26%] w-[26%] rounded-full bg-[#2a2d4a] opacity-80" />
              </span>
            </div>

            {/* Home indicator — 154×5pt */}
            <div className="pointer-events-none absolute inset-x-0 bottom-[0.9%] z-30 flex justify-center">
              <span className="w-[35%] rounded-full bg-zinc-900/90" style={{ aspectRatio: "154 / 5" }} />
            </div>

            {/* Glass reflection */}
            <div
              className="pointer-events-none absolute inset-0 z-40"
              style={{
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.035) 28%, transparent 52%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Side buttons — % of body so they scale with the frame */}
      {/* Action button */}
      <span className="absolute rounded-l-sm bg-gradient-to-r from-[#6f727a] to-[#a7aab1]" style={{ left: "-0.5%", top: "18%", width: "0.6%", height: "3.5%" }} />
      {/* Volume up / down */}
      <span className="absolute rounded-l-sm bg-gradient-to-r from-[#6f727a] to-[#a7aab1]" style={{ left: "-0.5%", top: "24.8%", width: "0.6%", height: "6.3%" }} />
      <span className="absolute rounded-l-sm bg-gradient-to-r from-[#6f727a] to-[#a7aab1]" style={{ left: "-0.5%", top: "32.4%", width: "0.6%", height: "6.3%" }} />
      {/* Power */}
      <span className="absolute rounded-r-sm bg-gradient-to-l from-[#6f727a] to-[#a7aab1]" style={{ right: "-0.5%", top: "26%", width: "0.6%", height: "9.8%" }} />
      {/* Camera Control */}
      <span className="absolute rounded-r-sm bg-gradient-to-l from-[#6f727a] to-[#a7aab1]" style={{ right: "-0.45%", top: "62%", width: "0.5%", height: "4.7%" }} />
    </div>
  );
}
