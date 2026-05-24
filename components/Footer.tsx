"use client";

import Link from "next/link";
import { useI18n, pick } from "@/lib/i18n";
import Logo from "./Logo";

export default function Footer() {
  const { locale, t } = useI18n();
  const year = new Date().getFullYear();

  const cols = [
    {
      title: pick(t.footer.product, locale),
      links: [
        { label: pick(t.nav.features, locale), href: "/#features" },
        { label: pick(t.nav.pricing, locale), href: "/#pricing" },
        { label: pick(t.nav.screenshots, locale), href: "/#screenshots" },
        { label: locale === "th" ? "Roadmap" : "Roadmap", href: "#" },
      ],
    },
    {
      title: pick(t.footer.company, locale),
      links: [
        { label: locale === "th" ? "เกี่ยวกับเรา" : "About", href: "/contact" },
        { label: locale === "th" ? "ติดต่อ" : "Contact", href: "/contact" },
        { label: locale === "th" ? "ร่วมงานกับเรา" : "Careers", href: "#" },
        { label: locale === "th" ? "พาร์ทเนอร์" : "Partners", href: "#" },
      ],
    },
    {
      title: pick(t.footer.resources, locale),
      links: [
        { label: pick(t.nav.blog, locale), href: "/blog" },
        { label: locale === "th" ? "ศูนย์ช่วยเหลือ" : "Help center", href: "#" },
        { label: locale === "th" ? "คู่มือใช้งาน" : "Documentation", href: "#" },
        { label: locale === "th" ? "API" : "API", href: "#" },
      ],
    },
    {
      title: pick(t.footer.legal, locale),
      links: [
        { label: locale === "th" ? "ข้อกำหนดการใช้งาน" : "Terms", href: "/terms" },
        { label: locale === "th" ? "นโยบายความเป็นส่วนตัว" : "Privacy", href: "/privacy" },
        { label: locale === "th" ? "คุกกี้" : "Cookies", href: "/privacy" },
      ],
    },
  ];

  return (
    <footer className="relative mt-32 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="text-lg font-semibold tracking-tight text-white">HostGate</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
              {pick(t.footer.tagline, locale)}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <SocialIcon href="#" label="Facebook">
                <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.5c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12H16l-.4 2.9h-2.2v7A10 10 0 0 0 22 12z" />
              </SocialIcon>
              <SocialIcon href="#" label="Line">
                <path d="M19 4H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3v3l4-3h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-9 8H8v-1h2v1zm0-2H8V9h2v1zm5 2h-3v-3h3v3z" />
              </SocialIcon>
              <SocialIcon href="#" label="X">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </SocialIcon>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold text-white">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-zinc-400 transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-8 md:flex-row md:items-center">
          <p className="text-xs text-zinc-500">
            © {year} HostGate. {pick(t.footer.rights, locale)}
          </p>
          <p className="text-xs text-zinc-500">
            Made with care for hospitality owners 🛏️
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:border-white/30 hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        {children}
      </svg>
    </a>
  );
}
