"use client";

import { ReactNode } from "react";

/**
 * Apple Studio Display-inspired frame — pure CSS, fully proportional.
 *
 * Modelled in points (display 1600×900, bezel 30, band 6) and expressed in
 * percentages / aspect-ratios only, so it scales cleanly at any width.
 *
 * The stand is drawn as three parts for a believable front view:
 *  - arm: brushed-aluminum column tucked BEHIND the display with an
 *    ambient-occlusion shadow where the display overhangs it
 *  - base plate: a receding top surface (trapezoid) + a darker front edge,
 *    which reads as a flat plate seen edge-on rather than a flat bar
 *  - soft contact + ambient floor shadows
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
      {/* Display — above the stand arm */}
      <div className="relative z-[1]">
        {/* Aluminum band */}
        <div
          className="relative bg-gradient-to-b from-[#dcdde1] via-[#a5a8af] to-[#75787f] p-[0.36%] shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]"
          style={{ borderRadius: "1.2% / 2.06%" }}
        >
          {/* Black bezel */}
          <div className="relative bg-black p-[1.81%]" style={{ borderRadius: "0.84% / 1.46%" }}>
            {/* Screen (16:9) */}
            <div
              className="relative w-full overflow-hidden bg-white [container-type:inline-size]"
              style={{ aspectRatio: "16 / 9", borderRadius: "0.25% / 0.44%" }}
            >
              <div className="absolute inset-0">{children}</div>
              {/* Subtle glass reflection */}
              <div
                className="pointer-events-none absolute inset-0 z-40"
                style={{
                  background:
                    "linear-gradient(112deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 30%, transparent 52%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Original short rectangular stand arm — brushed aluminum. */}
      <div
        className="relative z-0 mx-auto -mt-[0.9%] w-[16%] overflow-hidden"
        style={{
          aspectRatio: "16 / 5.2",
          background:
            "linear-gradient(90deg, #777b82 0%, #b4b7bd 18%, #e9eaed 42%, #f5f6f7 50%, #d0d2d7 62%, #9a9da4 84%, #686c73 100%)",
          boxShadow: "inset 1px 0 rgba(255,255,255,.28), inset -1px 0 rgba(34,38,44,.16)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-black/30 via-black/10 to-transparent" />
        <div className="absolute inset-x-[12%] bottom-0 h-px bg-white/45" />
      </div>

      {/* Original receding trapezoid base, with more natural aluminum tones. */}
      <div
        className="relative mx-auto w-[31%] overflow-hidden"
        style={{
          aspectRatio: "31 / 2",
          clipPath: "polygon(7% 0, 93% 0, 100% 100%, 0 100%)",
          background: "linear-gradient(180deg, #f6f7f8 0%, #e3e4e7 28%, #c8cbd0 68%, #aeb2b8 100%)",
          boxShadow: "inset 0 1px rgba(255,255,255,.95)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(38% 100% at 50% 0%, rgba(30,34,40,.18), transparent 66%), linear-gradient(90deg, rgba(70,74,80,.08), transparent 18%, transparent 82%, rgba(70,74,80,.09))",
          }}
        />
      </div>

      {/* Original thin front edge. */}
      <div
        className="relative mx-auto w-[31%] rounded-t-[1px] rounded-b-full"
        style={{
          aspectRatio: "31 / 0.9",
          background: "linear-gradient(180deg, #c8cbd0 0%, #a7aab0 30%, #858990 68%, #686c72 100%)",
          boxShadow: "inset 0 1px rgba(255,255,255,.38), 0 1px 1px rgba(26,30,36,.14)",
        }}
      />

      {/* Floor shadows — tight contact + wide ambient */}
      <div
        className="pointer-events-none mx-auto -mt-[0.35%] w-[34%] rounded-[50%] bg-black/[0.18] blur-md"
        style={{ aspectRatio: "34 / 1.6" }}
      />
      <div
        className="pointer-events-none mx-auto -mt-[1%] w-[54%] rounded-[50%] bg-black/[0.07] blur-xl"
        style={{ aspectRatio: "54 / 2.4" }}
      />
    </div>
  );
}
