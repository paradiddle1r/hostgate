# วิธีรัน Prontera loop / Kickoff prompt

คัดลอก prompt ข้างล่างนี้ให้ Prontera (หรือ agent วิศวกรรมตัวไหนก็ได้ที่เข้าถึง
repo นี้ + Supabase project ได้) รันซ้ำเป็น loop จนกว่างานใน checklist จะหมด
(เหลือแต่รายการ 🔒 ที่ต้องเป็นคนทำ)

แต่ละรอบ agent จะ: หยิบงานแรกที่ยังไม่เสร็จจาก `mobile/PLAN.md` §3 → อ่าน work
order ใน `mobile/prompts/NN-*.md` → ทำ → ผ่าน gate (`tsc` + `build` + `vitest`)
→ ติ๊ก checkbox + commit + push → รายงานสั้นๆ → รอบต่อไป

---

## KICKOFF PROMPT (paste ทั้งบล็อกนี้ให้ Prontera ทุกรอบ)

```
You are the engineering agent for the HostGate mobile project.

Repo: /path/to/HostGate.app  (Next.js 14 + Supabase, live SaaS at hostgate.app
— the web product is in production; do not break it.)

Your standing instructions are in mobile/prompts/00-loop-protocol.md — read it
FIRST and follow it exactly. Then execute ONE iteration of the loop:

1. Open mobile/PLAN.md, find §3 "Task checklist", pick the FIRST unchecked
   [ ] item that is not marked 🔒.
2. Read the matching work order mobile/prompts/NN-*.md and its "Read first"
   list in full.
3. Implement it completely. Respect every hard rule in the protocol
   (tenant isolation, ActionResult/HG-* conventions, theme tokens, TH/EN i18n,
   additive idempotent migrations).
4. Gates from repo root — ALL must pass or you are not done:
     npx tsc --noEmit && npm run build && npx vitest run
5. Check the box in mobile/PLAN.md, commit as
   "mobile(NN): <summary> [loop]", push to main.
6. Report in ≤5 lines: shipped / verified how / next task / blocked-on-🔒.

If every remaining item is 🔒, STOP and output the human TODO list instead.
```

---

## สถานะเริ่มต้น (Fable วางไว้ให้แล้ว)
- สถาปัตยกรรม + ทุก decision ล็อกแล้วใน `PLAN.md` §1 — loop ไม่ต้องตัดสินใจใหม่
- Capacitor shell config ครบทั้ง 2 แอป (`mobile/owner/`, `mobile/tenant/`)
- Migration drafts 2 ตัวใน `supabase/migrations/drafts/` (tenant portal + push)
  รอ loop review→apply ใน task 02a/03a
- Work orders 01–06 พร้อม acceptance criteria + verification ทุกตัว

## งานฝั่งคน (🔒) ที่ทำคู่ขนานได้เลย
1. สมัคร Google Play Console ($25 ครั้งเดียว) + Apple Developer ($99/ปี)
2. สร้าง Firebase project `hostgate-mobile` → เอา service-account JSON ใส่
   Supabase secret `FCM_SERVICE_ACCOUNT_JSON` + ดาวน์โหลด
   `google-services.json` / `GoogleService-Info.plist` ไว้
3. ติดตั้ง Android Studio + Xcode บนเครื่อง Mac
4. อัปโหลด APNs auth key เข้า Firebase (Cloud Messaging settings)
```
