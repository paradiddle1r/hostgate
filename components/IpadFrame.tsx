"use client";

import { ReactNode } from "react";

/**
 * iPad Pro-inspired frame — pure CSS.
 * Landscape orientation by default (16:10 aspect ratio, ~iPad Pro 11"/13").
 * Thin uniform black bezel + thin aluminum edge.
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
  // Aspect ratio: iPad Pro 13" is ~4:3 in portrait, 3:4 inversed for landscape
  const aspect = orientation === "landscape" ? "aspect-[4/3]" : "aspect-[3/4]";

  return (
    <div className={`relative mx-auto w-full device-shadow ${className}`}>
      {/* Aluminum outer edge */}
      <div className="relative rounded-[22px] bg-gradient-to-br from-[#d4d4d8] via-[#a1a1aa] to-[#71717a] p-[2px]">
        {/* Black bezel */}
        <div className="relative rounded-[20px] bg-black p-[10px]">
          {/* Screen */}
          <div className={`relative overflow-hidden rounded-[12px] bg-white ${aspect}`}>
            {children}
            {/* Front camera dot (top center) */}
            {orientation === "landscape" ? (
              <span className="pointer-events-none absolute left-2 top-1/2 z-30 h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-zinc-700" />
            ) : (
              <span className="pointer-events-none absolute left-1/2 top-2 z-30 h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-zinc-700" />
            )}
          </div>
        </div>
      </div>

      {/* Side buttons (only visible if portrait) */}
      {orientation === "portrait" && (
        <>
          <span className="absolute -right-[2px] top-[60px] h-[44px] w-[2px] rounded-r-sm bg-gradient-to-l from-[#71717a] to-[#a1a1aa]" />
          <span className="absolute -right-[2px] top-[120px] h-[28px] w-[2px] rounded-r-sm bg-gradient-to-l from-[#71717a] to-[#a1a1aa]" />
        </>
      )}
    </div>
  );
}
