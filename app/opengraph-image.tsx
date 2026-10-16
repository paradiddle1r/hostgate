import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HostGate — Hotel & Apartment PMS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  // Bundle the outlined logo into the edge route, avoiding a runtime request
  // back to the production domain while a release is being promoted.
  const logoResponse = await fetch(new URL("../public/brand/hostgate-a4-horizontal-color.svg", import.meta.url));
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  const logoData = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...logoBytes))}`;

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
            "radial-gradient(ellipse at top, #f5f3ff 0%, #ffffff 70%)",
          color: "#18181b",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* ImageResponse renders the same outlined mark used by the website. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoData} alt="HostGate" width={286} height={56} />
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
            color: "#18181b",
          }}
        >
          <span>Run your hotel</span>
          <span
            style={{
              background:
                "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
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
            color: "#71717a",
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
            color: "#a1a1aa",
          }}
        >
          <span>hostgate.app</span>
          <span style={{ color: "#d4d4d8" }}>·</span>
          <span>Start free · No credit card</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
