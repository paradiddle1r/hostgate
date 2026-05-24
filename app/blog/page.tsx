"use client";

import Link from "next/link";
import { blogPosts } from "@/lib/blog";
import { useI18n, pick } from "@/lib/i18n";

export default function BlogPage() {
  const { locale, t } = useI18n();

  return (
    <section className="relative pt-32 pb-20">
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-wider text-zinc-400">
            {pick(t.nav.blog, locale)}
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {pick(t.blog.title, locale)}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-zinc-400">
            {pick(t.blog.subtitle, locale)}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className={`relative h-40 bg-gradient-to-br ${post.gradient}`}>
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute left-4 bottom-3 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
                  {pick(post.category, locale)}
                </span>
              </div>
              <div className="p-5">
                <h2 className="text-base font-semibold text-white transition group-hover:text-white">
                  {pick(post.title, locale)}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                  {pick(post.excerpt, locale)}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {new Date(post.date).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>
                    {post.readMin} {pick(t.blog.minRead, locale)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
