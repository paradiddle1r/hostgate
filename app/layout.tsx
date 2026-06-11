import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import MarketingChrome from "@/components/MarketingChrome";

export const metadata: Metadata = {
  metadataBase: new URL("https://hostgate.app"),
  title: {
    default: "HostGate — Hotel & Apartment PMS",
    template: "%s · HostGate",
  },
  description:
    "HostGate คือระบบจัดการห้องพักครบวงจร สำหรับโรงแรม รีสอร์ท อพาร์ตเมนต์ และหอพัก เริ่มใช้งานฟรี ไม่ต้องใช้บัตรเครดิต",
  keywords: [
    "Hotel PMS",
    "Property Management System",
    "ระบบจัดการห้องพัก",
    "ระบบโรงแรม",
    "ระบบอพาร์ตเมนต์",
    "Channel Manager",
    "Booking system",
    "HostGate",
  ],
  authors: [{ name: "HostGate" }],
  openGraph: {
    title: "HostGate — Hotel & Apartment PMS",
    description:
      "ระบบจัดการห้องพักครบวงจร สำหรับเจ้าของโรงแรมและอพาร์ตเมนต์ เริ่มใช้งานฟรีวันนี้",
    url: "https://hostgate.app",
    siteName: "HostGate",
    type: "website",
    locale: "th_TH",
  },
  twitter: {
    card: "summary_large_image",
    title: "HostGate — Hotel & Apartment PMS",
    description: "ระบบจัดการห้องพักครบวงจร เริ่มต้นฟรี",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-white text-zinc-900">
        <I18nProvider>
          <MarketingChrome>{children}</MarketingChrome>
        </I18nProvider>
      </body>
    </html>
  );
}
