"use client";

import Link from "next/link";
import { getPost } from "@/lib/blog";
import { useI18n, pick } from "@/lib/i18n";

export default function PostView({ slug }: { slug: string }) {
  const { locale, t } = useI18n();
  const post = getPost(slug);
  if (!post) return null;
  const content = pick(post.content, locale);

  return (
    <article className="relative pt-32 pb-20">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <Link href="/blog" className="text-sm text-zinc-500 hover:text-zinc-900">
          {pick(t.blog.backToBlog, locale)}
        </Link>

        <div className={`mt-6 h-44 overflow-hidden rounded-2xl bg-gradient-to-br ${post.gradient} relative`}>
          <div className="absolute inset-0 bg-grid opacity-30 mix-blend-overlay" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">{pick(post.category, locale)}</span>
          <span>
            {new Date(post.date).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span>
            {post.readMin} {pick(t.blog.minRead, locale)}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          {pick(post.title, locale)}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-600">{pick(post.excerpt, locale)}</p>

        <div className="mt-10 max-w-none text-zinc-700">
          <MarkdownLite text={content} />
        </div>

        <hr className="my-12 border-zinc-200" />

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
          <p className="text-sm font-semibold text-zinc-900">
            {locale === "th"
              ? "พร้อมนำเทคนิคเหล่านี้ไปใช้กับธุรกิจของคุณ?"
              : "Ready to put these ideas to work?"}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {locale === "th"
              ? "เริ่มต้นใช้งาน HostGate ฟรีวันนี้"
              : "Start using HostGate for free today."}
          </p>
          <Link
            href="/#pricing"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            {pick(t.nav.start, locale)}
          </Link>
        </div>
      </div>
    </article>
  );
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let buf: string[] = [];

  const flush = () => {
    if (!buf.length) return;
    const para = buf.join(" ").trim();
    if (para) {
      out.push(
        <p key={out.length} className="my-4 leading-relaxed">
          {inline(para)}
        </p>
      );
    }
    buf = [];
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      out.push(
        <h2 key={out.length} className="mt-10 text-2xl font-bold text-zinc-900">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flush();
      out.push(
        <h3 key={out.length} className="mt-8 text-lg font-semibold text-zinc-900">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("- ")) {
      flush();
      out.push(
        <li key={out.length} className="my-1 ml-5 list-disc">
          {inline(line.slice(2))}
        </li>
      );
    } else if (line.trim() === "") {
      flush();
    } else {
      buf.push(line);
    }
  });
  flush();
  return <>{out}</>;
}

function inline(text: string) {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length > 0) {
    const codeM = rest.match(/`([^`]+)`/);
    const boldM = rest.match(/\*\*([^*]+)\*\*/);
    const next = [codeM, boldM]
      .filter((m): m is RegExpMatchArray => !!m)
      .sort((a, b) => a.index! - b.index!)[0];
    if (!next) {
      parts.push(rest);
      break;
    }
    if (next.index! > 0) parts.push(rest.slice(0, next.index));
    if (next === codeM) {
      parts.push(
        <code key={key++} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-indigo-700">
          {next[1]}
        </code>
      );
    } else {
      parts.push(
        <strong key={key++} className="font-semibold text-zinc-900">
          {next[1]}
        </strong>
      );
    }
    rest = rest.slice(next.index! + next[0].length);
  }
  return parts;
}
