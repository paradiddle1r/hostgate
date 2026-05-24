import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "นโยบายความเป็นส่วนตัวของ HostGate",
};

const title = {
  th: "นโยบายความเป็นส่วนตัว",
  en: "Privacy Policy",
};

const lastUpdated = "2026-05-01";

const bodyTh = [
  {
    heading: "1. ข้อมูลที่เราเก็บ",
    content:
      "เราเก็บข้อมูลที่คุณให้กับเราโดยตรง เช่น ชื่อ อีเมล เบอร์โทรศัพท์ และข้อมูลธุรกิจของคุณ รวมถึงข้อมูลการใช้งานเช่น IP address, ประเภทอุปกรณ์ และ cookies เพื่อปรับปรุงประสบการณ์การใช้งาน",
  },
  {
    heading: "2. การใช้ข้อมูล",
    content:
      "ข้อมูลของคุณจะถูกใช้เพื่อให้บริการระบบจัดการห้องพัก ติดต่อสื่อสารเกี่ยวกับบริการ ปรับปรุงคุณภาพระบบ และส่งข้อมูลการตลาดที่คุณยินยอม คุณสามารถถอนความยินยอมได้ทุกเมื่อ",
  },
  {
    heading: "3. การเปิดเผยข้อมูล",
    content:
      "เราจะไม่ขาย เช่า หรือเปิดเผยข้อมูลส่วนบุคคลของคุณแก่บุคคลที่สาม ยกเว้นกรณีที่จำเป็นต่อการให้บริการ (เช่น ผู้ให้บริการ cloud, ช่องทางชำระเงิน) หรือเพื่อปฏิบัติตามกฎหมาย",
  },
  {
    heading: "4. ความปลอดภัยของข้อมูล",
    content:
      "เราใช้การเข้ารหัสระดับสากล เก็บข้อมูลบน cloud ที่ได้รับมาตรฐาน ISO 27001 และสำรองข้อมูลทุกชั่วโมง อย่างไรก็ตามไม่มีระบบใดสมบูรณ์แบบ 100%",
  },
  {
    heading: "5. สิทธิของคุณ",
    content:
      "ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณมีสิทธิเข้าถึง แก้ไข ลบ ย้ายข้อมูล หรือคัดค้านการใช้ข้อมูลของคุณ ติดต่อเราได้ที่ privacy@hostgate.app",
  },
  {
    heading: "6. การเปลี่ยนแปลงนโยบาย",
    content:
      "เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว การเปลี่ยนแปลงสำคัญจะแจ้งให้คุณทราบทางอีเมลหรือในระบบ",
  },
];

const bodyEn = [
  {
    heading: "1. Information we collect",
    content:
      "We collect information you provide directly — name, email, phone, business details — as well as usage information like IP address, device type and cookies to improve your experience.",
  },
  {
    heading: "2. How we use your information",
    content:
      "Your information is used to provide our property management services, communicate with you about the service, improve quality, and send marketing communications you've opted into. You can withdraw consent at any time.",
  },
  {
    heading: "3. Sharing your information",
    content:
      "We do not sell, rent, or otherwise share your personal data with third parties, except as necessary to deliver our service (cloud providers, payment processors) or to comply with the law.",
  },
  {
    heading: "4. Security",
    content:
      "We use industry-standard encryption, store data on ISO 27001-certified cloud infrastructure, and back up your data hourly. No system is 100% secure.",
  },
  {
    heading: "5. Your rights",
    content:
      "Under Thailand's PDPA (and GDPR where applicable), you have the right to access, correct, delete, port, or object to use of your personal data. Contact us at privacy@hostgate.app.",
  },
  {
    heading: "6. Changes to this policy",
    content:
      "We may update this policy from time to time. Material changes will be communicated by email or in the product.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title={title}
      lastUpdated={lastUpdated}
      bodyTh={bodyTh}
      bodyEn={bodyEn}
    />
  );
}
