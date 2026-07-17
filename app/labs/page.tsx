import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Lab — HostGate",
  robots: { index: false, follow: false },
};

/**
 * Design Lab — 5 alternative landing-page directions, each a self-contained
 * sample at /labs/v1 … /labs/v5. Designed with Fable 5 + component patterns
 * from 21st.dev. Not linked from the main site; noindex.
 */
const VERSIONS = [
  {
    href: "/labs/v1",
    name: "V1 · Editorial",
    desc: "สไตล์นิตยสาร Swiss — ตัวอักษร serif ใหญ่, เส้นกริดบาง, ขาวดำ + แดงเดียว",
    swatch: ["#ffffff", "#18181b", "#e11d48"],
  },
  {
    href: "/labs/v2",
    name: "V2 · Glow",
    desc: "โทนมืดแบบ Linear — แสงเรือง indigo→cyan, การ์ดกระจก, dashboard เด่นกลางแสง",
    swatch: ["#09090b", "#6366f1", "#22d3ee"],
  },
  {
    href: "/labs/v3",
    name: "V3 · Bento",
    desc: "Bento grid สนุกๆ — ฟีเจอร์เป็นไทล์สีพาสเทล โชว์ของจริงในแต่ละช่อง",
    swatch: ["#fafaf9", "#818cf8", "#fbbf24"],
  },
  {
    href: "/labs/v4",
    name: "V4 · Brutal",
    desc: "Neo-brutalism — เส้นขอบหนา เงาแข็ง เหลือง acid + น้ำเงิน cobalt, marquee วิ่ง",
    swatch: ["#facc15", "#1d4ed8", "#111111"],
  },
  {
    href: "/labs/v5",
    name: "V5 · Boutique",
    desc: "บูทีคโฮเทลหรู — ครีม/ทราย ทองจางๆ serif ไทย อากาศเยอะ นิ่งและแพง",
    swatch: ["#faf6ef", "#a16207", "#3f3a33"],
  },
  {
    href: "/labs/v6",
    name: "V6 · Motion",
    desc: "แอนิเมชันจัดเต็ม — headline เบลอเข้าโฟกัส, aurora ไหล, ตัวเลขนับขึ้น, การ์ดลอย, ฟีดจองสด",
    swatch: ["#070711", "#a855f7", "#22d3ee"],
  },
];

export default function LabsIndex() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-indigo-400">
          HostGate Design Lab
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          หน้า Landing 5 เวอร์ชัน
        </h1>
        <p className="mt-3 text-zinc-400">
          ตัวอย่างทิศทางดีไซน์ 5 แบบสำหรับ hostgate.app — คนละอารมณ์ คนละแนว
          เปิดดูแล้วเลือกแนวที่ชอบได้เลย (ออกแบบร่วมกับ Fable 5 + แพตเทิร์นจาก 21st.dev)
        </p>

        <div className="mt-10 space-y-4">
          {VERSIONS.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className="group flex items-center gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-600 hover:bg-zinc-900"
            >
              <span className="flex shrink-0 -space-x-1.5">
                {v.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-8 w-8 rounded-full border border-zinc-700"
                    style={{ background: c }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold tracking-tight text-zinc-50">
                  {v.name}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-zinc-400">
                  {v.desc}
                </span>
              </span>
              <span className="text-zinc-500 transition group-hover:translate-x-1 group-hover:text-zinc-200">
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          <Link href="/" className="underline underline-offset-4 hover:text-zinc-300">
            ← กลับหน้าเว็บจริง
          </Link>
        </p>
      </div>
    </main>
  );
}
