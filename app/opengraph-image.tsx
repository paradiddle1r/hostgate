import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HostGate — Hotel & Apartment PMS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(ellipse at top, #1e1b4b 0%, #050816 70%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background:
                "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              color: "white",
            }}
          >
            H
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>HostGate</div>
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: 48,
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Run your hotel</span>
          <span
            style={{
              background:
                "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            the smart way
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            color: "#a1a1aa",
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          The all-in-one PMS for hotels, resorts, and apartments — built for Thailand.
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: 16,
            alignItems: "center",
            fontSize: 22,
            color: "#71717a",
          }}
        >
          <span>hostgate.app</span>
          <span style={{ color: "#3f3f46" }}>·</span>
          <span>Start free · No credit card</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
