import type { Metadata } from "next";
import V6Client from "./V6Client";

export const metadata: Metadata = {
  title: "V6 · Motion — HostGate Design Lab",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <V6Client />;
}
