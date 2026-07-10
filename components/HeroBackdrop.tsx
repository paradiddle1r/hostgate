"use client";

/**
 * Hero backdrop — floating hotel keycards, pure CSS.
 *
 * Replaces the old Three.js keycard scene (~600KB of three.js for two
 * cards). Two gradient keycards with chip / NFC waves / wordmark drift
 * gently behind the headline. Deterministic at every viewport (no camera
 * math), zero JS, SSR-rendered, and honors prefers-reduced-motion via the
 * global .hg-drift-* rules. Desktop-only, purely decorative.
 */

function Keycard({ flip = false }: { flip?: boolean }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[14px]"
      style={{
        background: flip
          ? "linear-gradient(315deg, #4f46e5 0%, #6366f1 55%, #8b5cf6 100%)"
          : "linear-gradient(135deg, #4f46e5 0%, #6366f1 55%, #8b5cf6 100%)",
        boxShadow:
          "0 40px 70px -28px rgba(79,70,229,0.5), 0 16px 32px -16px rgba(24,24,27,0.28), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 0 0 1px rgba(255,255,255,0.14)",
      }}
    >
      {/* sheen band */}
      <div
        className="absolute inset-y-[-20%] left-[38%] w-[22%] -skew-x-[18deg]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)" }}
      />
      {/* fine guilloché-ish arcs */}
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          background:
            "repeating-radial-gradient(120% 160% at 110% 120%, transparent 0, transparent 8px, rgba(255,255,255,0.5) 8.8px, transparent 9.6px)",
        }}
      />
      {/* wordmark */}
      <div className="absolute left-[9%] top-[10%] text-[15px] font-semibold leading-none tracking-tight text-white/95">
        HostGate
      </div>
      <div className="absolute left-[9%] top-[26%] text-[7px] font-medium uppercase leading-none tracking-[0.28em] text-white/65">
        Room Key
      </div>
      {/* NFC waves */}
      <svg viewBox="0 0 24 24" className="absolute right-[8%] top-[10%] h-[16%] w-auto text-white/80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M8.5 15.5a5 5 0 010-7" />
        <path d="M5.5 18.5a9.2 9.2 0 010-13" />
        <path d="M11.5 13a2 2 0 010-2" />
      </svg>
      {/* chip */}
      <div
        className="absolute left-[9%] top-[42%] h-[20%] w-[16%] rounded-[3px]"
        style={{
          background: "linear-gradient(135deg, #f2d787 0%, #caa64d 100%)",
          boxShadow: "inset 0 0 0 0.5px rgba(80,60,10,0.55), inset 0 -5px 0 -4px rgba(80,60,10,0.45), inset 0 6px 0 -5px rgba(255,255,255,0.6)",
        }}
      >
        <div className="absolute inset-y-0 left-1/3 w-px bg-[rgba(80,60,10,0.4)]" />
        <div className="absolute inset-y-0 right-1/3 w-px bg-[rgba(80,60,10,0.4)]" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-[rgba(80,60,10,0.4)]" />
      </div>
      {/* room line */}
      <div className="absolute bottom-[10%] left-[9%] text-[8px] font-medium leading-none tracking-[0.22em] text-white/85">
        SUITE&ensp;·&ensp;2401
      </div>
    </div>
  );
}

export default function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block">
      {/* soft glows that seat the cards into the page */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(26% 22% at 82% 22%, rgba(99,102,241,0.10), transparent 70%), radial-gradient(20% 18% at 12% 52%, rgba(139,92,246,0.08), transparent 70%), radial-gradient(30% 24% at 70% 80%, rgba(56,189,248,0.06), transparent 72%)",
        }}
      />

      {/* main card — right of the headline */}
      <div className="hg-drift-a absolute right-[5%] top-[17%] h-[133px] w-[212px]">
        <Keycard />
      </div>

      {/* companion card — far left, smaller, softened into the depth */}
      <div className="hg-drift-b absolute left-[3.5%] top-[46%] h-[92px] w-[146px] opacity-80 blur-[1.5px]">
        <Keycard flip />
      </div>
    </div>
  );
}
