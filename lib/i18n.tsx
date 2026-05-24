"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Locale = "th" | "en";

export const translations = {
  nav: {
    features: { th: "ฟีเจอร์", en: "Features" },
    screenshots: { th: "ตัวอย่าง", en: "Screenshots" },
    pricing: { th: "ราคา", en: "Pricing" },
    testimonials: { th: "รีวิว", en: "Testimonials" },
    faq: { th: "คำถาม", en: "FAQ" },
    blog: { th: "บทความ", en: "Blog" },
    login: { th: "เข้าสู่ระบบ", en: "Log in" },
    start: { th: "เริ่มต้นฟรี", en: "Start free" },
  },
  hero: {
    badge: { th: "ระบบใหม่ • ใช้งานฟรีตลอดชีพ สำหรับห้องไม่เกิน 5 ห้อง", en: "New • Free forever for up to 5 rooms" },
    title1: { th: "ระบบจัดการห้องพัก", en: "Run your hotel" },
    title2: { th: "ที่เจ้าของหอพักรัก", en: "the smart way" },
    subtitle: {
      th: "HostGate คือ Hotel & Apartment PMS ครบวงจร จัดการ Booking, Check-in/out, Channel Manager, แม่บ้าน และรายงานยอดขาย จบในที่เดียว ใช้ได้ทั้งบนมือถือและคอม",
      en: "HostGate is the all-in-one Hotel & Apartment PMS. Manage bookings, check-in/out, channels, housekeeping and reports — all from one beautiful dashboard, on any device.",
    },
    ctaPrimary: { th: "เริ่มใช้งานฟรี", en: "Start for free" },
    ctaSecondary: { th: "ดู Demo", en: "Watch demo" },
    note: { th: "ไม่ต้องใช้บัตรเครดิต • ตั้งค่าใน 5 นาที", en: "No credit card required • Set up in 5 minutes" },
  },
  trusted: {
    title: { th: "เชื่อใจโดยที่พักทั่วประเทศไทย", en: "Trusted by properties across Thailand" },
  },
  features: {
    badge: { th: "ฟีเจอร์", en: "Features" },
    title: { th: "ทุกอย่างที่หอพักของคุณต้องการ", en: "Everything your property needs" },
    subtitle: {
      th: "ออกแบบมาเพื่อเจ้าของโรงแรม รีสอร์ท อพาร์ตเมนต์ และโฮสเทล — เริ่มใช้งานง่ายในไม่กี่นาที",
      en: "Built for hotel, resort, apartment and hostel owners — set up in minutes, scale to thousands of rooms.",
    },
    items: [
      {
        title: { th: "จัดการ Reservation", en: "Reservation Management" },
        desc: {
          th: "ปฏิทินจองห้องแบบลากวาง รวมทุก OTA ในที่เดียว เห็นสถานะห้องแบบ real-time",
          en: "Drag-and-drop booking calendar with real-time room status from every OTA in one view.",
        },
      },
      {
        title: { th: "Channel Manager", en: "Channel Manager" },
        desc: {
          th: "เชื่อมต่อ Booking.com, Agoda, Airbnb, Expedia — ราคาและห้องว่างซิงค์อัตโนมัติ ไม่กลัว overbooking",
          en: "Sync rates and availability across Booking.com, Agoda, Airbnb and Expedia. No more overbookings.",
        },
      },
      {
        title: { th: "Front Desk & Check-in", en: "Front Desk & Check-in" },
        desc: {
          th: "Check-in/Check-out ภายใน 30 วินาที พิมพ์ใบเสร็จ สร้างบัตรลูกค้า บันทึกบัตรประชาชน",
          en: "Check guests in and out in 30 seconds. Print receipts, store ID scans, build guest profiles.",
        },
      },
      {
        title: { th: "Online Booking Engine", en: "Online Booking Engine" },
        desc: {
          th: "เพิ่ม widget จองห้องบนเว็บไซต์ของคุณ ไม่เสียค่า commission ลูกค้าจองตรงได้ทันที",
          en: "Embed a booking widget on your own site and take direct bookings with zero commission.",
        },
      },
      {
        title: { th: "Housekeeping", en: "Housekeeping" },
        desc: {
          th: "พนักงานแม่บ้านอัปเดตสถานะห้องจากมือถือ ระบบแจ้งเตือนห้องค้างทำความสะอาด",
          en: "Housekeepers update room status from their phone with automatic alerts for rooms needing attention.",
        },
      },
      {
        title: { th: "รายงาน & Analytics", en: "Reports & Analytics" },
        desc: {
          th: "รายงานยอดขาย, RevPAR, ADR, Occupancy แบบ real-time ส่งออก Excel/PDF ได้ทันที",
          en: "Real-time revenue, RevPAR, ADR and occupancy reports. Export to Excel or PDF instantly.",
        },
      },
      {
        title: { th: "ระบบชำระเงิน", en: "Payments" },
        desc: {
          th: "รองรับ PromptPay, บัตรเครดิต, โอนผ่านธนาคาร — ออกใบกำกับภาษีและใบเสร็จอัตโนมัติ",
          en: "Accept PromptPay, credit cards and bank transfers. Auto-generate tax invoices and receipts.",
        },
      },
      {
        title: { th: "Multi-Property", en: "Multi-Property" },
        desc: {
          th: "บริหารหลายสาขาในบัญชีเดียว เปรียบเทียบยอดขายระหว่างสาขา แบ่งสิทธิ์พนักงานได้",
          en: "Run multiple properties from one account. Compare branches and manage staff permissions.",
        },
      },
      {
        title: { th: "Mobile First", en: "Mobile First" },
        desc: {
          th: "ใช้งานได้ทุกที่ ทุกเวลา ผ่าน iOS, Android และ Web — ออกแบบมาให้คล่องตัวบนมือถือ",
          en: "Works beautifully on iOS, Android and web — built mobile-first for owners on the go.",
        },
      },
    ],
  },
  screenshots: {
    badge: { th: "แดชบอร์ด", en: "Dashboard" },
    title: { th: "ดีไซน์ที่สะอาด ใช้งานง่าย แม้พนักงานใหม่", en: "Clean, intuitive — even new staff get it" },
    subtitle: {
      th: "อินเตอร์เฟซที่เข้าใจง่ายในแบบเดียวกับแอปที่คุณใช้ทุกวัน เน้นการมองเห็นและความเร็ว",
      en: "An interface that feels familiar from day one — designed for speed and clarity.",
    },
  },
  pricing: {
    badge: { th: "ราคา", en: "Pricing" },
    title: { th: "ราคาที่ตรงไปตรงมา เริ่มต้นฟรี", en: "Simple pricing. Start free." },
    subtitle: {
      th: "ทุกแพ็กเกจมาพร้อมฟีเจอร์หลัก ยกระดับเมื่อพร้อม ยกเลิกได้ทุกเมื่อ",
      en: "Every plan includes core features. Upgrade when you're ready. Cancel anytime.",
    },
    monthly: { th: "รายเดือน", en: "Monthly" },
    yearly: { th: "รายปี (ประหยัด 20%)", en: "Yearly (save 20%)" },
    perMonth: { th: "/เดือน", en: "/month" },
    contactSales: { th: "ติดต่อฝ่ายขาย", en: "Contact sales" },
    startFree: { th: "เริ่มต้นฟรี", en: "Start free" },
    choosePlan: { th: "เลือกแผนนี้", en: "Choose this plan" },
    mostPopular: { th: "ยอดนิยมที่สุด", en: "Most popular" },
    plans: [
      {
        name: { th: "Free", en: "Free" },
        priceTHB: "0",
        tagline: { th: "เริ่มต้นฟรีตลอดชีพ", en: "Free forever" },
        rooms: { th: "ไม่เกิน 5 ห้อง", en: "Up to 5 rooms" },
        features: {
          th: [
            "Reservation Calendar",
            "Check-in / Check-out",
            "รายงานพื้นฐาน",
            "1 ผู้ใช้งาน",
            "การสนับสนุนทางอีเมล",
          ],
          en: [
            "Reservation calendar",
            "Check-in / Check-out",
            "Basic reports",
            "1 staff user",
            "Email support",
          ],
        },
      },
      {
        name: { th: "Starter", en: "Starter" },
        priceTHB: "590",
        tagline: { th: "สำหรับหอพัก/เกสต์เฮาส์ขนาดเล็ก", en: "For small properties" },
        rooms: { th: "6–20 ห้อง", en: "6–20 rooms" },
        features: {
          th: [
            "ทุกอย่างใน Free",
            "เชื่อมต่อ 2 OTA",
            "Online Booking Engine",
            "PromptPay & QR Payment",
            "ผู้ใช้งาน 3 คน",
          ],
          en: [
            "Everything in Free",
            "Connect 2 OTAs",
            "Online booking engine",
            "PromptPay & QR payments",
            "3 staff users",
          ],
        },
      },
      {
        name: { th: "Pro", en: "Pro" },
        priceTHB: "1,990",
        tagline: { th: "สำหรับโรงแรม/รีสอร์ทที่กำลังโต", en: "For growing hotels" },
        rooms: { th: "21–50 ห้อง", en: "21–50 rooms" },
        popular: true,
        features: {
          th: [
            "ทุกอย่างใน Starter",
            "Channel Manager (ทุก OTA)",
            "Housekeeping module",
            "Multi-property",
            "ผู้ใช้งานไม่จำกัด",
            "การสนับสนุน 24/7",
          ],
          en: [
            "Everything in Starter",
            "Channel manager (all OTAs)",
            "Housekeeping module",
            "Multi-property",
            "Unlimited staff users",
            "24/7 support",
          ],
        },
      },
      {
        name: { th: "Enterprise", en: "Enterprise" },
        priceTHB: "custom",
        tagline: { th: "สำหรับเครือโรงแรม", en: "For hotel groups" },
        rooms: { th: "ไม่จำกัด", en: "Unlimited rooms" },
        features: {
          th: [
            "ทุกอย่างใน Pro",
            "API & Integrations",
            "SSO / SLA",
            "ผู้จัดการบัญชีดูแล",
            "Onboarding เฉพาะคุณ",
            "การฝึกอบรมพนักงาน",
          ],
          en: [
            "Everything in Pro",
            "API & integrations",
            "SSO / SLA",
            "Dedicated account manager",
            "Tailored onboarding",
            "Staff training",
          ],
        },
      },
    ],
  },
  howItWorks: {
    badge: { th: "ขั้นตอน", en: "How it works" },
    title: { th: "เริ่มใช้งานใน 3 ขั้นตอน", en: "Get started in 3 steps" },
    subtitle: {
      th: "ไม่ต้องเขียนโค้ด ไม่ต้องลงโปรแกรม — สมัครแล้วเริ่มรับจองได้เลย",
      en: "No code, no installs — sign up and start taking bookings.",
    },
    steps: [
      {
        title: { th: "สมัครและเพิ่มห้อง", en: "Sign up and add your rooms" },
        desc: {
          th: "สร้างบัญชีฟรี ใส่ข้อมูลห้องและราคา ใช้เวลาประมาณ 5 นาที",
          en: "Create a free account, add your rooms and rates. Takes about 5 minutes.",
        },
      },
      {
        title: { th: "เชื่อมต่อ OTA", en: "Connect your OTAs" },
        desc: {
          th: "เลือก OTA ที่ใช้อยู่ — Booking, Agoda, Airbnb, Expedia ระบบซิงค์ให้อัตโนมัติ",
          en: "Pick your OTAs — Booking, Agoda, Airbnb, Expedia — and we sync them automatically.",
        },
      },
      {
        title: { th: "รับจองและเก็บเงิน", en: "Take bookings and get paid" },
        desc: {
          th: "เริ่มรับการจองจากทุกช่องทาง รับชำระผ่าน PromptPay บัตรเครดิต และโอน",
          en: "Start taking bookings from every channel. Accept PromptPay, cards, and bank transfers.",
        },
      },
    ],
  },
  integrations: {
    badge: { th: "การเชื่อมต่อ", en: "Integrations" },
    title: { th: "ทำงานร่วมกับเครื่องมือที่คุณใช้อยู่", en: "Plays well with the tools you already use" },
    subtitle: {
      th: "เชื่อมต่อ OTA ระบบชำระเงิน และระบบบัญชีในไม่กี่คลิก",
      en: "Connect to OTAs, payment gateways, and accounting tools in just a few clicks.",
    },
  },
  comparison: {
    badge: { th: "เปรียบเทียบ", en: "Comparison" },
    title: { th: "ทำไม HostGate ถึงต่างจากเครื่องมืออื่น", en: "Why HostGate is different" },
    subtitle: {
      th: "ดูชัด ๆ ว่าทำไมเจ้าของที่พักเปลี่ยนมาใช้ HostGate",
      en: "See exactly why hosts switch to HostGate.",
    },
    cols: {
      feature: { th: "ฟีเจอร์", en: "Feature" },
      hostgate: { th: "HostGate", en: "HostGate" },
      excel: { th: "Excel / กระดาษ", en: "Excel / Paper" },
      other: { th: "PMS อื่น", en: "Other PMS" },
    },
    rows: [
      { label: { th: "ติดตั้งภายใน 5 นาที", en: "Setup in 5 minutes" }, hostgate: "yes", excel: "yes", other: "no" },
      { label: { th: "เริ่มต้นฟรี (ไม่มีบัตรเครดิต)", en: "Free to start (no card)" }, hostgate: "yes", excel: "yes", other: "no" },
      { label: { th: "Channel Manager ในตัว", en: "Built-in channel manager" }, hostgate: "yes", excel: "no", other: "yes" },
      { label: { th: "PromptPay & QR Payment", en: "PromptPay & QR payments" }, hostgate: "yes", excel: "no", other: "no" },
      { label: { th: "แอปมือถือ (iOS/Android)", en: "Mobile app (iOS/Android)" }, hostgate: "yes", excel: "no", other: "no" },
      { label: { th: "ภาษาไทยเต็มรูปแบบ", en: "Full Thai language" }, hostgate: "yes", excel: "yes", other: "no" },
      { label: { th: "การสนับสนุนภาษาไทย 24/7", en: "Thai 24/7 support" }, hostgate: "yes", excel: "no", other: "no" },
    ],
  },
  contact: {
    pageTitle: { th: "ติดต่อเรา", en: "Contact us" },
    pageSubtitle: {
      th: "พูดคุยกับทีม HostGate — เราพร้อมช่วยให้คุณเริ่มต้นได้เร็วที่สุด",
      en: "Talk to the HostGate team. We are here to help you get started fast.",
    },
    name: { th: "ชื่อ", en: "Name" },
    namePh: { th: "เช่น คุณนิว", en: "e.g. John Smith" },
    email: { th: "อีเมล", en: "Email" },
    emailPh: { th: "you@example.com", en: "you@example.com" },
    phone: { th: "เบอร์โทรศัพท์", en: "Phone" },
    phonePh: { th: "080-xxx-xxxx", en: "+66 80 xxx xxxx" },
    property: { th: "ชื่อที่พัก", en: "Property name" },
    propertyPh: { th: "เช่น Sukhumvit Boutique", en: "e.g. Sukhumvit Boutique" },
    rooms: { th: "จำนวนห้อง", en: "Number of rooms" },
    selectRooms: { th: "เลือกขนาด", en: "Select size" },
    message: { th: "ข้อความ", en: "Message" },
    messagePh: {
      th: "บอกเราเกี่ยวกับธุรกิจของคุณและสิ่งที่กำลังมองหา",
      en: "Tell us about your business and what you are looking for",
    },
    submit: { th: "ส่งข้อความ", en: "Send message" },
    submitting: { th: "กำลังส่ง…", en: "Sending…" },
    success: {
      th: "ส่งข้อความเรียบร้อย! ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง",
      en: "Got it. We will reach out within 24 hours.",
    },
    otherChannels: { th: "ช่องทางอื่น", en: "Other channels" },
    lineLabel: { th: "LINE Official", en: "LINE Official" },
    fbLabel: { th: "Facebook Messenger", en: "Facebook Messenger" },
    emailDirect: { th: "อีเมล", en: "Email" },
    phoneDirect: { th: "โทรศัพท์", en: "Phone" },
  },
  legal: {
    privacyTitle: { th: "นโยบายความเป็นส่วนตัว", en: "Privacy Policy" },
    termsTitle: { th: "ข้อกำหนดการใช้งาน", en: "Terms of Service" },
    lastUpdated: { th: "ปรับปรุงล่าสุด", en: "Last updated" },
  },
  testimonials: {
    badge: { th: "เสียงจากผู้ใช้", en: "Testimonials" },
    title: { th: "เจ้าของที่พักทั่วประเทศเลือก HostGate", en: "Hosts everywhere choose HostGate" },
    items: [
      {
        name: "คุณนิว",
        role: { th: "เจ้าของ Sukhumvit Boutique Apartment", en: "Owner, Sukhumvit Boutique Apartment" },
        quote: {
          th: "เปลี่ยนจากการจดในสมุดมาใช้ HostGate ภายในวันเดียว ทีมงานเข้าใจระบบทันที ยอดจองตรงเพิ่มขึ้น 30%",
          en: "We moved from paper notebooks to HostGate in a single day. Direct bookings are up 30%.",
        },
      },
      {
        name: "Khun May",
        role: { th: "Manager, Chiang Mai Riverside Resort", en: "Manager, Chiang Mai Riverside Resort" },
        quote: {
          th: "ระบบ Channel Manager แม่นมาก ไม่เคย overbooking เลยตั้งแต่ใช้ การสนับสนุนตอบเร็วทุกครั้ง",
          en: "The channel manager is rock solid — zero overbookings since we switched. Support is incredibly responsive.",
        },
      },
      {
        name: "คุณบอย",
        role: { th: "เจ้าของหอพักนักศึกษา 40 ห้อง", en: "Owner, 40-room student dorm" },
        quote: {
          th: "เก็บค่าเช่ารายเดือนได้ผ่าน PromptPay สบายมาก ไม่ต้องไล่เก็บเงินเองอีกแล้ว",
          en: "Collecting monthly rent via PromptPay is effortless — no more chasing tenants for payment.",
        },
      },
      {
        name: "Khun Pim",
        role: { th: "เจ้าของ Phuket Pool Villa", en: "Owner, Phuket Pool Villa" },
        quote: {
          th: "Dashboard สวย ใช้ง่ายมาก ดูยอดขายจากมือถือได้ทุกที่ คุ้มเกินราคา",
          en: "Beautiful dashboard, runs perfectly on my phone. Worth every baht.",
        },
      },
    ],
  },
  faq: {
    badge: { th: "คำถามที่พบบ่อย", en: "FAQ" },
    title: { th: "ทุกอย่างที่คุณอยากรู้", en: "Everything you want to know" },
    items: [
      {
        q: { th: "ใช้ฟรีได้จริงตลอดชีพไหม?", en: "Is it really free forever?" },
        a: {
          th: "ใช่ครับ แผน Free ใช้ได้ตลอดชีพสำหรับที่พักไม่เกิน 5 ห้อง ไม่มีค่าธรรมเนียมแอบแฝง ไม่ต้องใช้บัตรเครดิต",
          en: "Yes. The Free plan is free forever for up to 5 rooms — no hidden fees, no credit card required.",
        },
      },
      {
        q: { th: "ใช้เวลาตั้งค่ากี่นาที?", en: "How long does setup take?" },
        a: {
          th: "ประมาณ 5–10 นาทีก็เริ่มรับจองได้ทันที ทีมงานพร้อมช่วย onboarding ฟรีสำหรับแผน Pro ขึ้นไป",
          en: "About 5–10 minutes to take your first booking. Pro plans get free white-glove onboarding.",
        },
      },
      {
        q: { th: "เชื่อมต่อกับ Agoda / Booking.com ได้ไหม?", en: "Does it sync with Agoda / Booking.com?" },
        a: {
          th: "ได้ครับ Channel Manager ของ HostGate รองรับ OTA ยอดนิยมทั้งหมด รวมถึง Airbnb และ Expedia ราคา/ห้องว่างซิงค์อัตโนมัติ",
          en: "Yes. Our channel manager supports all major OTAs including Agoda, Booking.com, Airbnb and Expedia — rates and availability sync automatically.",
        },
      },
      {
        q: { th: "ข้อมูลของฉันปลอดภัยไหม?", en: "Is my data secure?" },
        a: {
          th: "ปลอดภัยตามมาตรฐานระดับโลก เข้ารหัสข้อมูล end-to-end เก็บข้อมูลบน cloud ที่ผ่านมาตรฐาน ISO 27001 พร้อมระบบสำรองข้อมูลทุกชั่วโมง",
          en: "We use enterprise-grade encryption, ISO 27001-certified cloud infrastructure, and back up your data hourly.",
        },
      },
      {
        q: { th: "ยกเลิกได้เมื่อไหร่?", en: "Can I cancel anytime?" },
        a: {
          th: "ยกเลิกได้ทุกเมื่อจากในระบบ ไม่มีค่าธรรมเนียม ดาวน์เกรดกลับไปแผน Free ก็ยังใช้งานต่อได้",
          en: "Cancel anytime in your dashboard with no fees. You can also downgrade back to the Free plan and keep going.",
        },
      },
      {
        q: { th: "มีแอปบนมือถือไหม?", en: "Is there a mobile app?" },
        a: {
          th: "มีครับ ทั้ง iOS และ Android เข้าใช้งานหลักได้ทุกฟีเจอร์ พนักงานแม่บ้านก็มีโหมดเฉพาะ",
          en: "Yes — iOS and Android apps with full functionality, plus a dedicated housekeeping mode for staff.",
        },
      },
    ],
  },
  cta: {
    title: { th: "พร้อมเริ่มต้นกับ HostGate?", en: "Ready to get started with HostGate?" },
    subtitle: {
      th: "เริ่มใช้งานฟรีวันนี้ ไม่ต้องใช้บัตรเครดิต ตั้งค่าใน 5 นาที",
      en: "Start free today. No credit card. Set up in 5 minutes.",
    },
    primary: { th: "สมัครใช้งานฟรี", en: "Create free account" },
    secondary: { th: "พูดคุยกับฝ่ายขาย", en: "Talk to sales" },
  },
  footer: {
    tagline: { th: "ระบบจัดการห้องพักสำหรับเจ้าของที่พักยุคใหม่", en: "PMS for modern hospitality owners." },
    product: { th: "ผลิตภัณฑ์", en: "Product" },
    company: { th: "บริษัท", en: "Company" },
    resources: { th: "แหล่งข้อมูล", en: "Resources" },
    legal: { th: "ข้อกำหนด", en: "Legal" },
    rights: { th: "สงวนลิขสิทธิ์", en: "All rights reserved." },
  },
  blog: {
    title: { th: "บทความและคู่มือ", en: "Articles & Guides" },
    subtitle: {
      th: "เทคนิคและไอเดียในการบริหารที่พักให้รายได้เติบโต",
      en: "Tips and ideas to grow your property's revenue.",
    },
    readMore: { th: "อ่านต่อ", en: "Read more" },
    minRead: { th: "นาที", en: "min read" },
    backToBlog: { th: "← กลับไปหน้าบทความ", en: "← Back to blog" },
  },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: typeof translations;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("th");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("hostgate-locale") : null;
    if (stored === "th" || stored === "en") setLocaleState(stored);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem("hostgate-locale", l);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function pick<T>(obj: { th: T; en: T }, locale: Locale): T {
  return obj[locale];
}
