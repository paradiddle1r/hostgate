"use client";

import { ReactNode } from "react";

/**
 * iPad Pro 13" (M4) frame — pure CSS, fully proportional.
 *
 * Modelled in device points (display 1376×1032pt 4:3, bezel 44pt, band 4pt
 * → body 1472×1128pt) and expressed only in percentages / aspect-ratios /
 * `x% / y%` radius pairs, so proportions hold at any rendered width.
 * Camera sits on the long edge (top in landscape), like the M4 iPads.
 */
export default function IpadFrame({
  children,
  className = "",
  orientation = "landscape",
}: {
  children: ReactNode;
  className?: string;
  orientation?: "landscape" | "portrait";
}) {
  const landscape = orientation === "landscape";

  const band = landscape
    ? { padding: "0.27%", borderRadius: "5.03% / 6.56%" }
    : { padding: "0.35%", borderRadius: "6.56% / 5.03%" };
  const bezel = landscape
    ? { padding: "3%", borderRadius: "4.78% / 6.25%" }
    : { padding: "3.93%", borderRadius: "6.25% / 4.78%" };
  const screen = landscape
    ? { aspectRatio: "1376 / 1032", borderRadius: "1.89% / 2.52%" }
    : { aspectRatio: "1032 / 1376", borderRadius: "2.52% / 1.89%" };

  return (
    <div className={`relative mx-auto w-full device-shadow ${className}`}>
      {/* Aluminum band */}
      <div
        className="relative bg-gradient-to-br from-[#e0e1e5] via-[#a5a8af] to-[#63666d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]"
        style={band}
      >
        {/* Black bezel — the camera lives here, centered in the ring */}
        <div className="relative bg-black" style={bezel}>
          {landscape ? (
            <span
              className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#151a24] shadow-[inset_0_0_0_0.5px_rgba(90,120,180,0.5)]"
              style={{ top: "1.95%", width: "0.75%", aspectRatio: "1" }}
            />
          ) : (
            <span
              className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#151a24] shadow-[inset_0_0_0_0.5px_rgba(90,120,180,0.5)]"
              style={{ left: "1.95%", width: "1%", aspectRatio: "1" }}
            />
          )}

          {/* Screen */}
          <div
            className="relative w-full overflow-hidden bg-white [container-type:inline-size]"
            style={screen}
          >
            <div className="absolute inset-0">{children}</div>
            {/* Glass reflection */}
            <div
              className="pointer-events-none absolute inset-0 z-40"
              style={{
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 30%, transparent 55%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Edge buttons — scale with the body */}
      {landscape ? (
        <>
          {/* With the landscape camera at the top, the portrait top edge has
              rotated to the left: the single top/power button belongs here. */}
          <span
            className="absolute rounded-l-full bg-gradient-to-r from-[#666a72] via-[#9da1a8] to-[#d6d8dc] shadow-[0_0_0_0.35px_rgba(40,44,50,0.35)]"
            style={{ left: "-0.5%", top: "5.6%", width: "max(1px, 0.55%)", height: "6.5%" }}
          />
          {/* Volume buttons sit on the landscape top edge, near the left. */}
          <span className="absolute rounded-t-full bg-gradient-to-b from-[#d6d8dc] via-[#9da1a8] to-[#666a72] shadow-[0_-0.4px_0_rgba(255,255,255,0.7),0_0_0_0.35px_rgba(40,44,50,0.35)]" style={{ top: "-0.38%", left: "6.9%", width: "3.6%", height: "max(1px, 0.5%)" }} />
          <span className="absolute rounded-t-full bg-gradient-to-b from-[#d6d8dc] via-[#9da1a8] to-[#666a72] shadow-[0_-0.4px_0_rgba(255,255,255,0.7),0_0_0_0.35px_rgba(40,44,50,0.35)]" style={{ top: "-0.38%", left: "11.2%", width: "3.6%", height: "max(1px, 0.5%)" }} />
        </>
      ) : (
        <>
          {/* power (top-right in portrait) */}
          <span className="absolute rounded-t-sm bg-gradient-to-b from-[#a7aab1] to-[#6f727a]" style={{ top: "-0.4%", right: "2%", width: "5.2%", height: "0.45%" }} />
          {/* volume (right edge) */}
          <span className="absolute rounded-r-sm bg-gradient-to-l from-[#a7aab1] to-[#6f727a]" style={{ right: "-0.5%", top: "6%", width: "0.55%", height: "3.4%" }} />
          <span className="absolute rounded-r-sm bg-gradient-to-l from-[#a7aab1] to-[#6f727a]" style={{ right: "-0.5%", top: "10.2%", width: "0.55%", height: "3.4%" }} />
        </>
      )}
    </div>
  );
}
