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

const lastUpdated = "2026-07-17";

const bodyTh = [
  {
    heading: "1. ข้อมูลที่เราเก็บ",
    content:
      "เราเก็บข้อมูลที่คุณให้กับเราโดยตรง เช่น ชื่อ อีเมล เบอร์โทรศัพท์ และข้อมูลธุรกิจของคุณ รวมถึงข้อมูลการใช้งานเช่น IP address, ประเภทอุปกรณ์ และ cookies เพื่อปรับปรุงประสบการณ์การใช้งาน",
  },
  {
    heading: "2. การเข้าสู่ระบบด้วยบัญชีโซเชียล",
    content:
      "หากคุณเลือกเข้าสู่ระบบด้วย Google, Facebook หรือ LINE เราจะได้รับข้อมูลที่ผู้ให้บริการนั้นอนุญาตให้แบ่งปัน เช่น ชื่อ อีเมล รูปโปรไฟล์ และรหัสประจำตัวบัญชี เพื่อนำมาใช้สร้างบัญชี ระบุตัวตน รักษาความปลอดภัยในการเข้าสู่ระบบ และเชื่อมวิธีเข้าสู่ระบบหลายช่องทางที่ใช้อีเมลเดียวกัน เราไม่ขอสิทธิ์โพสต์หรือเข้าถึงรายชื่อผู้ติดต่อของคุณ",
  },
  {
    heading: "3. การใช้ข้อมูล",
    content:
      "ข้อมูลของคุณจะถูกใช้เพื่อให้บริการระบบจัดการห้องพัก ติดต่อสื่อสารเกี่ยวกับบริการ ปรับปรุงคุณภาพระบบ และส่งข้อมูลการตลาดที่คุณยินยอม คุณสามารถถอนความยินยอมได้ทุกเมื่อ",
  },
  {
    heading: "4. การเปิดเผยข้อมูล",
    content:
      "เราจะไม่ขาย เช่า หรือเปิดเผยข้อมูลส่วนบุคคลของคุณแก่บุคคลที่สาม ยกเว้นกรณีที่จำเป็นต่อการให้บริการ (เช่น ผู้ให้บริการ cloud, ช่องทางชำระเงิน) หรือเพื่อปฏิบัติตามกฎหมาย",
  },
  {
    heading: "5. ความปลอดภัยของข้อมูล",
    content:
      "เราใช้การเข้ารหัสระดับสากล เก็บข้อมูลบน cloud ที่ได้รับมาตรฐาน ISO 27001 และสำรองข้อมูลทุกชั่วโมง อย่างไรก็ตามไม่มีระบบใดสมบูรณ์แบบ 100%",
  },
  {
    heading: "6. สิทธิของคุณ",
    content:
      "ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณมีสิทธิเข้าถึง แก้ไข ลบ ย้ายข้อมูล หรือคัดค้านการใช้ข้อมูลของคุณ ติดต่อเราได้ที่ privacy@hostgate.app",
  },
  {
    heading: "7. การเปลี่ยนแปลงนโยบาย",
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
    heading: "2. Social sign-in",
    content:
      "If you sign in with Google, Facebook, or LINE, we receive information that provider allows you to share, such as your name, email address, profile photo, and provider account identifier. We use it to create your account, identify you, secure sign-in, and link sign-in methods that use the same verified email. We do not request permission to post or access your contacts.",
  },
  {
    heading: "3. How we use your information",
    content:
      "Your information is used to provide our property management services, communicate with you about the service, improve quality, and send marketing communications you've opted into. You can withdraw consent at any time.",
  },
  {
    heading: "4. Sharing your information",
    content:
      "We do not sell, rent, or otherwise share your personal data with third parties, except as necessary to deliver our service (cloud providers, payment processors) or to comply with the law.",
  },
  {
    heading: "5. Security",
    content:
      "We use industry-standard encryption, store data on ISO 27001-certified cloud infrastructure, and back up your data hourly. No system is 100% secure.",
  },
  {
    heading: "6. Your rights",
    content:
      "Under Thailand's PDPA (and GDPR where applicable), you have the right to access, correct, delete, port, or object to use of your personal data. Contact us at privacy@hostgate.app.",
  },
  {
    heading: "7. Changes to this policy",
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
