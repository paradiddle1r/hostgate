import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "ข้อกำหนดการใช้งาน HostGate",
};

const title = {
  th: "ข้อกำหนดการใช้งาน",
  en: "Terms of Service",
};

const lastUpdated = "2026-05-01";

const bodyTh = [
  {
    heading: "1. การยอมรับข้อกำหนด",
    content:
      "การใช้บริการ HostGate ถือว่าคุณยอมรับข้อกำหนดเหล่านี้ทั้งหมด หากไม่ยอมรับ กรุณาหยุดใช้บริการ",
  },
  {
    heading: "2. การสร้างบัญชี",
    content:
      "คุณต้องให้ข้อมูลที่ถูกต้องและเป็นปัจจุบันเมื่อสร้างบัญชี คุณรับผิดชอบในการรักษารหัสผ่านและการเข้าถึงบัญชีของตน",
  },
  {
    heading: "3. แผนการใช้งานและการชำระเงิน",
    content:
      "แผน Free ใช้ได้ฟรีตลอดชีพภายใต้ข้อจำกัด สำหรับแผนชำระเงิน ค่าบริการจะถูกตัดเป็นรอบที่กำหนด (เดือน/ปี) คุณยกเลิกได้ทุกเมื่อ — เมื่อยกเลิก การใช้งานจะดำเนินต่อจนสิ้นรอบที่ชำระแล้ว",
  },
  {
    heading: "4. การใช้งานที่ยอมรับได้",
    content:
      "คุณตกลงที่จะไม่ใช้บริการเพื่อกิจกรรมที่ผิดกฎหมาย การละเมิดสิทธิของผู้อื่น การส่งสแปม หรือกิจกรรมที่อาจทำให้ระบบเสียหาย",
  },
  {
    heading: "5. ความเป็นเจ้าของข้อมูล",
    content:
      "ข้อมูลของคุณยังคงเป็นของคุณ HostGate มีสิทธิเข้าถึงข้อมูลของคุณเฉพาะเพื่อให้บริการเท่านั้น คุณสามารถส่งออกข้อมูลของคุณได้ทุกเมื่อ",
  },
  {
    heading: "6. การให้บริการและความน่าเชื่อถือ",
    content:
      "เรามุ่งมั่นรักษา uptime ที่ 99.99% แต่ไม่รับประกันบริการที่ปราศจากข้อบกพร่องทั้งหมด เราจะแจ้งช่วงเวลาบำรุงรักษาล่วงหน้าเมื่อเป็นไปได้",
  },
  {
    heading: "7. การยกเลิกบริการ",
    content:
      "เราอาจระงับหรือยกเลิกบัญชีของคุณหากพบการละเมิดข้อกำหนด ในกรณีนี้คุณจะมีเวลา 30 วันในการส่งออกข้อมูล",
  },
  {
    heading: "8. การจำกัดความรับผิด",
    content:
      "HostGate ให้บริการแบบ \"ตามสภาพ\" และในขอบเขตที่กฎหมายอนุญาต เราไม่รับผิดชอบต่อความเสียหายทางอ้อมหรือผลที่ตามมาจากการใช้บริการ",
  },
  {
    heading: "9. กฎหมายที่ใช้บังคับ",
    content:
      "ข้อกำหนดเหล่านี้อยู่ภายใต้กฎหมายของประเทศไทย ข้อพิพาทใด ๆ จะอยู่ภายใต้เขตอำนาจของศาลในกรุงเทพมหานคร",
  },
];

const bodyEn = [
  {
    heading: "1. Acceptance of terms",
    content:
      "By using HostGate you accept these terms in full. If you do not agree, please stop using the service.",
  },
  {
    heading: "2. Account creation",
    content:
      "You must provide accurate, current information when creating an account. You are responsible for maintaining the security of your password and account.",
  },
  {
    heading: "3. Plans and billing",
    content:
      "The Free plan is free forever subject to limits. Paid plans are billed on the cycle you select (monthly/yearly). You can cancel at any time; access continues until the end of the paid period.",
  },
  {
    heading: "4. Acceptable use",
    content:
      "You agree not to use the service for illegal activity, violation of others' rights, spam, or any activity that may damage the system.",
  },
  {
    heading: "5. Data ownership",
    content:
      "Your data remains yours. HostGate accesses your data only to deliver the service. You may export your data at any time.",
  },
  {
    heading: "6. Service availability",
    content:
      "We target 99.99% uptime but do not warrant defect-free service. We give advance notice of maintenance windows where possible.",
  },
  {
    heading: "7. Termination",
    content:
      "We may suspend or terminate accounts that violate these terms. In that event you have 30 days to export your data.",
  },
  {
    heading: "8. Limitation of liability",
    content:
      "HostGate is provided \"as is\". To the extent permitted by law, we are not liable for indirect or consequential damages.",
  },
  {
    heading: "9. Governing law",
    content:
      "These terms are governed by the laws of Thailand. Disputes are subject to the courts of Bangkok.",
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title={title}
      lastUpdated={lastUpdated}
      bodyTh={bodyTh}
      bodyEn={bodyEn}
    />
  );
}
