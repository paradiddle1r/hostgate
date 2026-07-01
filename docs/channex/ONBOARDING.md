# Channex onboarding runbook — from zero to certified PMS partner

สถานะปัจจุบัน: โค้ดฝั่ง HostGate พร้อมทั้งหมดแล้ว (webhook receiver, revisions
feed + ack, ARI queue แบบ batch, provisioning, admin console) — เหลือแค่สมัคร
staging, ใส่ env แล้วเริ่มทดสอบ

## Step 1 — สมัคร staging (คุณทำเอง ~5 นาที)

1. ไปที่ **https://staging.channex.io** → สมัครบัญชี (self-service, ฟรี)
2. สร้าง API key: **Organization → API Keys** (โชว์ครั้งเดียว — เก็บทันที)
3. ใส่ env บน Vercel (project `hostgate`):
   - `CHANNEX_BASE_URL` = `https://staging.channex.io`
   - `CHANNEX_API_KEY` = คีย์จากข้อ 2
   - `CHANNEX_WEBHOOK_SECRET` = สุ่มยาว ๆ (เช่น `openssl rand -hex 24`)
   - `CRON_SECRET` = สุ่มอีกชุด
   - `SUPABASE_SERVICE_ROLE_KEY` = จาก Supabase dashboard → hostgate → Settings → API
   - `PLATFORM_ADMIN_EMAILS` = `pornchailin@gmail.com`
4. Redeploy แล้วเปิด **admin.hostgate.app** → Channex → **Test Channex API**
   (ควรขึ้น OK)

## Step 2 — ทดสอบ end-to-end บน staging

1. หน้า Channex ใน admin: เลือก property → **Connect** → **Provision**
   (ระบบจะสร้าง property + room types + BAR rate plans บน Channex, ลงทะเบียน
   webhook และ push ARI 500 วันให้อัตโนมัติ)
2. เปิด **Channels** (iframe) → ต่อ channel ทดสอบของ Channex → ทำ mapping
3. สร้าง booking ทดสอบจากฝั่ง channel → ดูใน admin → Events ว่า revision
   เข้ามา, acked ✓, applied ✓ และ booking โผล่ในปฏิทิน PMS ของ tenant

## Step 3 — Certification (เมื่อพร้อมขอ production)

Test property มาตรฐานตามสเปคเขา (สร้างผ่าน PMS จริงของเรา):
- ชื่อ **"Test Property - (HostGate)"**, สกุลเงิน **USD**
- Room types: **Twin Room**, **Double Room** (occupancy 2)
- Rate plans 4 ตัว: BAR Twin, BAR Double, B&B Twin, B&B Double
- ใส่ราคา/ห้องว่างแบบสมจริง ไม่ flat

รัน 14 สถานการณ์ (ดูรายละเอียดใน admin → Docs หรือ
https://docs.channex.io/api-v.1-documentation/pms-certification-tests)
จด **task ID** ที่ Channex ตอบกลับทุกครั้ง แล้วส่งฟอร์ม:
**https://forms.gle/xA8F3eSYBPBd8apYA**
จากนั้นนัด screenshare ให้เขาดูว่าเรากดจาก UI จริง (ห้ามใช้ Postman/สคริปต์)

ระบบเราออกแบบให้ผ่านเกณฑ์อยู่แล้ว: batch เดียวต่อการเปลี่ยนแปลง N รายการ,
full sync 500 วันใน 2 calls, delta-only, คิว + throttle, ack ทุก revision,
availability zeroing ตอนมี booking

## Step 4 — ติดต่อ Channex (ร่างอีเมล — ส่งเองจาก pornchailin@gmail.com)

> **To:** support@channex.io
> **Subject:** PMS partnership — HostGate (hostgate.app)
>
> Hi Channex team,
>
> We are HostGate (https://hostgate.app), a multi-tenant property management
> system for small hotels and serviced apartments in Thailand, built on
> Next.js + Supabase. Each of our customers runs their own property on our
> PMS, and we'd like to offer OTA connectivity through Channex as our channel
> manager, white-labeled inside our admin/tenant UI.
>
> We have already built our integration against your staging environment:
> properties/room-types/rate-plans provisioning via API, batched ARI updates
> (availability + restrictions) with per-property queueing, booking ingestion
> via the booking-revisions feed with acknowledgements, webhooks, and the
> channel-mapping iframe via one-time tokens.
>
> Could you let us know:
> 1. The partner/white-label agreement terms and per-property pricing for
>    PMS partners
> 2. Anything you need from us before we schedule certification
>    (we're ready to run the 14 certification scenarios on staging)
> 3. The process/timeline for production credentials after certification
>
> Company: [ชื่อบริษัท/ผู้ติดต่อ/ที่อยู่]
> Volume expectation: starting ~10–50 properties in Thailand, growing.
>
> Best regards,
> Pornchai — HostGate

## Post-certification (production)

1. รับ production access → สร้าง production API key
2. Vercel env: `CHANNEX_BASE_URL=https://app.channex.io` + คีย์ production
3. Re-provision ทุก property (connection ใหม่ environment=production)
4. ต่อ OTA จริง (Booking.com / Airbnb / Agoda / Expedia) ผ่าน Channels iframe
5. (เฟสถัดไป) บัตรเครดิต: เริ่มด้วย **Stripe Tokenization app** (ไม่ต้องมี
   PCI cert) หรือ **Payment App**; ถ้าต้องการ PAN เต็ม → SAQ D AOC + whitelist
   ผ่าน support@channex.io

## Infra notes

- Webhook URL ที่ลงทะเบียนอัตโนมัติตอน Provision:
  `https://hostgate.app/api/channex/webhook` + header `x-hostgate-secret`
- Cron กันตกหล่น: Vercel cron รายวัน (02:30 BKK) + Supabase pg_cron ทุก 5 นาที
  เรียก `GET https://hostgate.app/api/channex/cron` (Bearer CRON_SECRET)
- ตาราง DB: `channex_connections / channex_room_type_map / channex_rate_plan_map /
  channex_bookings / channex_booking_revisions / channex_webhook_events /
  channex_ari_queue / channex_sync_log / platform_admins` (migration 20)
