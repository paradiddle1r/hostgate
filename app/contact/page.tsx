import type { Metadata } from "next";
import ContactView from "./ContactView";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "ติดต่อทีม HostGate เพื่อขอ demo สอบถามราคา หรือเริ่มใช้งานระบบจัดการห้องพัก",
};

export default function ContactPage() {
  return <ContactView />;
}
