export interface BlogPost {
  slug: string;
  title: { th: string; en: string };
  excerpt: { th: string; en: string };
  category: { th: string; en: string };
  date: string;
  readMin: number;
  author: string;
  gradient: string;
  content: { th: string; en: string }; // simple markdown-ish
}

export const blogPosts: BlogPost[] = [
  {
    slug: "boost-direct-bookings",
    title: {
      th: "5 วิธีเพิ่มยอด Direct Booking ให้ที่พักของคุณ",
      en: "5 ways to boost direct bookings for your property",
    },
    excerpt: {
      th: "ลด commission จาก OTA ด้วยการเพิ่มช่องทางจองตรง พร้อมเทคนิคทำให้ลูกค้ากลับมาจองอีก",
      en: "Cut OTA commissions and grow loyal guests with these proven direct-booking tactics.",
    },
    category: { th: "การตลาด", en: "Marketing" },
    date: "2026-05-12",
    readMin: 6,
    author: "HostGate Team",
    gradient: "from-indigo-500 to-fuchsia-500",
    content: {
      th: `## ทำไม Direct Booking ถึงสำคัญ

OTA เก็บค่า commission 15-25% ของแต่ละการจอง การเพิ่ม Direct Booking เพียง 10% ก็เพิ่มกำไรอย่างเห็นได้ชัด

### 1. ใส่ Booking Widget บนเว็บไซต์ของคุณ

ลูกค้าที่เข้ามาดูเว็บไซต์โดยตรงคือกลุ่มที่มีโอกาสจองสูงที่สุด HostGate Online Booking Engine ฝัง widget บนเว็บไซต์ของคุณได้ฟรี

### 2. สร้าง Loyalty Program

ส่วนลด 10% สำหรับลูกค้าเก่าที่จองผ่านเว็บโดยตรง เก็บข้อมูลลูกค้าผ่าน Guest CRM

### 3. ตอบทุก Inquiry ภายใน 1 ชั่วโมง

ความเร็วในการตอบเป็นปัจจัยสำคัญในการปิดการจอง

### 4. ใช้ Facebook & Instagram Ads

ทำ ad ไปยังหน้าจองของคุณโดยตรง ลด CAC ได้มาก

### 5. รีวิวจากลูกค้าเก่า

ใส่รีวิวจริงจาก Google และ Facebook บนหน้าเว็บ เพิ่มความน่าเชื่อถือ`,
      en: `## Why direct bookings matter

OTAs charge 15-25% commission on every reservation. Even a 10% lift in direct bookings can dramatically improve your margin.

### 1. Add a booking widget to your site

Direct site visitors are your highest-intent traffic. HostGate's online booking engine embeds for free.

### 2. Build a loyalty program

Offer 10% off for repeat guests who book direct. Use Guest CRM to collect emails.

### 3. Respond to inquiries within an hour

Response speed is the single biggest predictor of conversion.

### 4. Run Facebook & Instagram ads

Send traffic to your direct booking page — far lower CAC than OTAs.

### 5. Showcase real reviews

Pull reviews from Google and Facebook onto your homepage to build trust.`,
    },
  },
  {
    slug: "channel-manager-explained",
    title: {
      th: "Channel Manager คืออะไร? ทำไมโรงแรมยุคใหม่ต้องมี",
      en: "What is a channel manager and why every hotel needs one",
    },
    excerpt: {
      th: "ทำความเข้าใจระบบ Channel Manager แบบบ้าน ๆ พร้อมเหตุผลว่าทำไมต้องใช้ก่อนจะเกิด overbooking",
      en: "A plain-English guide to channel managers and why they prevent the costliest mistake in hospitality: overbookings.",
    },
    category: { th: "ความรู้พื้นฐาน", en: "Fundamentals" },
    date: "2026-05-08",
    readMin: 5,
    author: "HostGate Team",
    gradient: "from-emerald-500 to-cyan-500",
    content: {
      th: `## Channel Manager คืออะไร?

Channel Manager คือระบบที่เชื่อมต่อระหว่าง PMS ของคุณกับ OTA ทุกช่องทาง (Booking.com, Agoda, Airbnb, Expedia) เพื่อซิงค์ "ราคา" และ "ห้องว่าง" แบบ real-time

### ปัญหาที่จะเกิดถ้าไม่ใช้

- **Overbooking**: ห้องเดียวกันถูกจองจากหลาย OTA — ต้องชดเชยให้ลูกค้าราคาแพง
- **ราคาไม่ตรงกัน**: แต่ละแพลตฟอร์มอัปเดตช้า ลูกค้าเห็นราคาคนละราคา
- **เสียเวลาพนักงาน**: ต้องล็อกอินเข้าแต่ละ OTA เพื่อปรับราคา

### HostGate Channel Manager ทำอะไรบ้าง?

ซิงค์ทุก OTA ภายใน 30 วินาที, ตั้งราคาเป็นช่วง (seasonal pricing), จัดการ Minimum Stay และ Restrictions ได้`,
      en: `## What is a channel manager?

A channel manager connects your PMS to every OTA (Booking.com, Agoda, Airbnb, Expedia) and syncs rates and availability in real time.

### What happens without one

- **Overbookings**: the same room sold across multiple channels
- **Price mismatches**: rates drift across platforms, eroding trust
- **Wasted staff time**: logging into each OTA manually

### What HostGate's channel manager does

Syncs every OTA within 30 seconds, supports seasonal pricing, manages minimum-stay rules and restrictions.`,
    },
  },
  {
    slug: "occupancy-vs-adr-vs-revpar",
    title: {
      th: "Occupancy, ADR, RevPAR — ตัวเลขสำคัญที่เจ้าของโรงแรมต้องรู้",
      en: "Occupancy, ADR, RevPAR: the metrics every hotel owner must know",
    },
    excerpt: {
      th: "อธิบาย 3 ตัวชี้วัดสำคัญที่บอกสุขภาพของธุรกิจที่พัก พร้อมวิธีคำนวณและตัวอย่าง",
      en: "The three KPIs that tell you everything about your property's health — with formulas and examples.",
    },
    category: { th: "ความรู้พื้นฐาน", en: "Fundamentals" },
    date: "2026-05-01",
    readMin: 7,
    author: "HostGate Team",
    gradient: "from-amber-500 to-rose-500",
    content: {
      th: `## ตัวชี้วัด 3 ตัวที่สำคัญที่สุด

### 1. Occupancy Rate (อัตราการเข้าพัก)

\`Occupancy = (ห้องที่ขายได้ ÷ ห้องที่มีทั้งหมด) × 100\`

ตัวอย่าง: โรงแรม 50 ห้อง ขายได้ 40 ห้อง → Occupancy = 80%

### 2. ADR — Average Daily Rate (ราคาห้องเฉลี่ย)

\`ADR = รายได้ค่าห้องรวม ÷ จำนวนห้องที่ขายได้\`

ตัวอย่าง: รายได้ 80,000 บาท ขายได้ 40 ห้อง → ADR = 2,000 บาท

### 3. RevPAR — Revenue Per Available Room

\`RevPAR = ADR × Occupancy Rate\` หรือ \`รายได้รวม ÷ ห้องทั้งหมด\`

นี่คือตัวชี้วัด "ความสำเร็จ" ที่แท้จริง

### ใช้อย่างไร?

ติดตามทุกวันใน HostGate Dashboard เปรียบเทียบกับเดือนก่อน เพื่อตัดสินใจว่าจะปรับราคาขึ้นหรือเร่งโปรโมชั่น`,
      en: `## The three metrics that matter most

### 1. Occupancy Rate

\`Occupancy = (Rooms sold ÷ Available rooms) × 100\`

Example: 50-room hotel sells 40 rooms → 80% occupancy.

### 2. ADR — Average Daily Rate

\`ADR = Room revenue ÷ Rooms sold\`

Example: ฿80,000 revenue across 40 rooms → ฿2,000 ADR.

### 3. RevPAR — Revenue Per Available Room

\`RevPAR = ADR × Occupancy\` or \`Total revenue ÷ Available rooms\`

This is the true measure of property performance.

### How to use them

Track daily in your HostGate dashboard, compare against last period, and decide whether to raise rates or run a promotion.`,
    },
  },
];

export function getPost(slug: string) {
  return blogPosts.find((p) => p.slug === slug);
}
