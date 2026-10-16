import Image from "next/image";

/** Selected A4: four room blocks and one reservation span form an H. */
export default function Logo({ className = "h-8 w-8", inverted = false }: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="4" y="7" width="16" height="15" rx="3.5" fill="#FF6656" />
      <rect x="44" y="7" width="16" height="15" rx="3.5" fill="#FF6656" />
      <rect x="4" y="25" width="56" height="14" rx="4" fill={inverted ? "#FFFFFF" : "#1C2B4D"} />
      <rect x="4" y="43" width="16" height="15" rx="3.5" fill="#FF6656" />
      <rect x="44" y="43" width="16" height="15" rx="3.5" fill="#FF6656" />
    </svg>
  );
}

/** Outlined Nunito wordmark: no browser font substitution or layout shift. */
export function BrandLockup({ className = "h-7 w-auto", inverted = false }: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Image
      src={`/brand/hostgate-a4-horizontal-${inverted ? "reverse" : "color"}.svg`}
      alt="HostGate"
      width={490}
      height={96}
      className={className}
      unoptimized
    />
  );
}
