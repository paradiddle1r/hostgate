import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
    <html lang="en" className="dark">
      <body className="min-h-screen overflow-x-hidden">
        <I18nProvider>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_50%,transparent_100%)]" />
            <Navbar />
            <main>{children}</main>
            <Footer />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
