# HostGate.app — Marketing Website

เว็บไซต์ premium สำหรับขายระบบ PMS ของ HostGate.app ครับ
สร้างด้วย Next.js 14 (App Router) + TypeScript + Tailwind CSS รองรับ 2 ภาษา (ไทย/อังกฤษ) และ deploy บน Vercel ได้ทันที

## หน้าและ Routes (build ผ่านแล้ว 13 routes)

```
/                            — Landing page (Hero, Features, How it works,
                                Screenshots, Integrations, Comparison,
                                Pricing, Testimonials, FAQ, CTA)
/blog                        — Blog listing
/blog/[slug]                 — 3 บทความตัวอย่าง (SEO-friendly)
/contact                     — ฟอร์มขอ demo + ช่องทาง LINE/FB/Email
/privacy                     — Privacy Policy (PDPA-ready)
/terms                       — Terms of Service
/sitemap.xml                 — สร้างอัตโนมัติ
/robots.txt                  — สร้างอัตโนมัติ
/opengraph-image             — OG image dynamic สำหรับ FB/LINE share
```

## โครงสร้างไฟล์

```
app/                 — หน้าเว็บ (App Router)
  layout.tsx, page.tsx, globals.css
  blog/, contact/, privacy/, terms/
  sitemap.ts, robots.ts, opengraph-image.tsx
components/          — Hero, Features, HowItWorks, Screenshots,
                       Integrations, Comparison, Pricing, Testimonials,
                       FAQ, CTA, Navbar, Footer, LanguageToggle, ...
lib/
  i18n.tsx           — ระบบสลับภาษา (TH/EN) — แก้ข้อความที่เดียวจบ
  blog.ts            — เนื้อหาบทความ
public/favicon.svg
```

## เริ่มต้นใช้งาน (Quick start)

เปิด Terminal ที่โฟลเดอร์นี้แล้วรันคำสั่งนี้ทีเดียว:

```bash
cd /Users/pornchai/Documents/HostGate.app
rm -rf node_modules .next        # ล้าง folder ค้างจาก sandbox (ครั้งแรกเท่านั้น)
npm install                       # ติดตั้ง dependencies (~1 นาที)
npm run dev                       # เปิด http://localhost:3000
```

คำสั่ง build production:

```bash
npm run build && npm run start
```

## เผยแพร่ขึ้น GitHub + Vercel

### 1) Push ขึ้น GitHub (repo ชื่อ `hostgate`)

เปิด Terminal ที่ macOS Mac ของคุณ:

```bash
cd /Users/pornchai/Documents/HostGate.app

# ล้าง node_modules ที่ค้างจาก sandbox (ครั้งแรกเท่านั้น)
rm -rf node_modules .next

# ขั้นตอน git (ครั้งเดียว)
git init
git add .
git commit -m "feat: initial HostGate marketing site"
git branch -M main

# 👇 แทนที่ <your-username> ด้วย GitHub username ของคุณ
git remote add origin https://github.com/<your-username>/hostgate.git
git push -u origin main
```

> 💡 ครั้งต่อไปแก้ไฟล์แล้วต้องการ deploy ใหม่ แค่ `git add . && git commit -m "update" && git push` Vercel จะ deploy ให้อัตโนมัติ

### 2) Deploy ขึ้น Vercel (ตัวเลือก)

**วิธี A — ผ่าน GitHub (แนะนำ ✅)**
1. เข้า https://vercel.com/new
2. กด "Import" ที่ repo `hostgate`
3. Vercel detect Next.js อัตโนมัติ
4. **Environment Variables** ก่อนกด Deploy ใส่ 2 ตัวนี้:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xwikaqpdulkscdysgxri.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dFw0KTzS79rl7w0FhjiUmA_YNya2sJH
   ```
   (ถ้าย้าย Supabase ไป org ใหม่ ค่าทั้งสองจะเปลี่ยน เดี๋ยวบอกใหม่)
5. กด Deploy

**วิธี B — Vercel CLI (เร็วกว่า ไม่ต้องผ่าน GitHub ก็ได้)**
```bash
cd /Users/pornchai/Documents/HostGate.app
npm i -g vercel              # ถ้ายังไม่มี
vercel login                  # log in ด้วย email
vercel link                   # ผูกโฟลเดอร์นี้กับ project ใหม่
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod                 # deploy production
```

### 3) ผูกโดเมน hostgate.app

1. Vercel Dashboard → project hostgate → **Settings → Domains**
2. **Add Domain** → `hostgate.app`
3. ถ้าโดเมนซื้อผ่าน Vercel แล้ว ระบบผูกอัตโนมัติ
4. แนะนำเพิ่ม `www.hostgate.app` ด้วยและให้ redirect ไป root

### 2) เชื่อม Vercel กับ repo นี้

1. เข้า https://vercel.com/new
2. เลือก GitHub repo `hostgate-website`
3. Framework Preset: Next.js (Vercel detect ให้อัตโนมัติ)
4. กด **Deploy** — ใช้เวลาประมาณ 1-2 นาทีในการ build ครั้งแรก

### 3) ผูกโดเมน hostgate.app

1. ใน Vercel Dashboard → Project → **Settings → Domains**
2. กด **Add Domain** → พิมพ์ `hostgate.app`
3. ถ้าโดเมนซื้อผ่าน Vercel อยู่แล้ว ระบบจะผูกให้อัตโนมัติ
4. แนะนำเพิ่ม `www.hostgate.app` ด้วยและให้ redirect ไป `hostgate.app` (ตั้งใน UI ของ Vercel ได้เลย)

### 4) อัปเดตเว็บ

หลังจาก deploy แล้ว ทุกครั้งที่ `git push` เข้า branch `main` Vercel จะ build/deploy ให้อัตโนมัติ
เปิด Pull Request ก็จะได้ **preview URL** อัตโนมัติเช่นกัน

## Supabase (ติดตั้งและเชื่อมต่อให้แล้ว ✅)

- **Project ID:** `xwikaqpdulkscdysgxri`
- **URL:** `https://xwikaqpdulkscdysgxri.supabase.co`
- **Region:** Singapore (ap-southeast-1)
- **ตาราง:** `contact_submissions`, `waitlist` — มี RLS + validation
- **Client:** `lib/supabase.ts` — ฟอร์ม `/contact` บันทึก lead อัตโนมัติ
- **env vars:** ดู `.env.local` (อยู่ใน .gitignore แล้ว — ปลอดภัย)

ดู lead ที่เก็บได้บน https://supabase.com/dashboard/project/xwikaqpdulkscdysgxri/editor

## ปรับแต่งเนื้อหา

- **ข้อความทั้งหมด**: แก้ใน `lib/i18n.tsx` (มีทั้ง th/en ในที่เดียว)
- **แผนราคา**: แก้ใน `lib/i18n.tsx` ที่ key `pricing.plans`
- **บทความบล็อก**: แก้/เพิ่มใน `lib/blog.ts`
- **โลโก้**: แก้ไฟล์ `components/Logo.tsx` และ `public/favicon.svg`
- **สี**: แก้ใน `tailwind.config.ts` และ `app/globals.css`

## SEO

ระบบใส่ metadata, Open Graph และ Twitter Card ให้อัตโนมัติแล้ว
แนะนำเพิ่ม OG image จริงในอนาคต ที่ `public/og.png` (1200x630)

## License

© HostGate. All rights reserved.
