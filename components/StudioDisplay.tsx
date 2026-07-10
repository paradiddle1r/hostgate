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

      {/* Stand arm — brushed metal column behind the display */}
      <div
        className="relative z-0 mx-auto -mt-[0.9%] w-[16%]"
        style={{
          aspectRatio: "16 / 5.2",
          background:
            "linear-gradient(90deg, #74787f 0%, #b9bcc2 28%, #e0e2e6 50%, #b3b6bd 72%, #686c73 100%)",
        }}
      >
        {/* AO: display overhang shadow at the top of the arm */}
        <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-black/35 to-transparent" />
      </div>

      {/* Base plate — receding top surface (trapezoid, catches the light) */}
      <div
        className="relative mx-auto w-[31%]"
        style={{
          aspectRatio: "31 / 2",
          clipPath: "polygon(7% 0, 93% 0, 100% 100%, 0 100%)",
          background: "linear-gradient(180deg, #eef0f2 0%, #cdd0d6 100%)",
        }}
      >
        {/* AO where the arm meets the plate */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(42% 90% at 50% 0%, rgba(0,0,0,0.22), transparent 68%)" }}
        />
      </div>

      {/* Base plate — front edge */}
      <div
        className="relative mx-auto w-[31%] rounded-t-[1px] rounded-b-full"
        style={{
          aspectRatio: "31 / 0.9",
          background: "linear-gradient(180deg, #c6c9cf 0%, #9598a0 55%, #73767d 100%)",
        }}
      />

      {/* Floor shadows — tight contact + wide ambient */}
      <div
        className="pointer-events-none mx-auto -mt-[0.35%] w-[34%] rounded-[50%] bg-black/25 blur-md"
        style={{ aspectRatio: "34 / 1.6" }}
      />
      <div
        className="pointer-events-none mx-auto -mt-[1%] w-[54%] rounded-[50%] bg-black/10 blur-xl"
        style={{ aspectRatio: "54 / 2.4" }}
      />
    </div>
  );
}
