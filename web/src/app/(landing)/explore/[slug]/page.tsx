// /explore/<slug>: the public page for one tool in the open catalogue. Built from the cached catalogue (the same
// data /explore uses), so it needs no database work of its own and every page is prerendered.
import type { Metadata } from "next";
import { Gloock } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { env } from "@/lib/env";
import { catalogueEntry, publicSlugs, type CatalogueEntry } from "@/lib/public-catalogue";
import { MagneticButton } from "../../_sections/buttons";
import { Spotlight } from "../../_sections/maker-card";
import { Nav } from "../../_sections/nav";
import { Footer } from "../../_sections/open-source";
import "../../landing.css";
import "../../_sections/maker-card.css";
import "./tool.css";

const display = Gloock({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });

const humanize = (s: string) => {
  const t = s.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const CREATIVE = new Set(["prompt", "template", "resource", "course"]);

export async function generateStaticParams() {
  const slugs = await publicSlugs();
  // Cache Components needs at least one param to validate the route; an unknown slug just 404s.
  return (slugs.length ? slugs : ["_"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/explore/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const item = (await catalogueEntry(slug))?.item;
  if (!item) return { title: "Tool not found" };
  const url = `/explore/${item.slug}`;
  return {
    title: item.name,
    description: item.summary,
    alternates: { canonical: url, types: { "text/markdown": `${url}.md` } },
    openGraph: { title: item.name, description: item.summary, url, type: "website", siteName: "Orphic" },
    twitter: { card: "summary_large_image", title: item.name, description: item.summary },
  };
}

export default function ToolPage({ params }: PageProps<"/explore/[slug]">) {
  return (
    <div className={`lp ${display.variable} min-h-full`}>
      <Nav />
      <main className="pt-16">
        <Suspense fallback={<ToolSkeleton />}>
          <Tool params={params} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

async function Tool({ params }: { params: PageProps<"/explore/[slug]">["params"] }) {
  const { slug } = await params;
  const entry = await catalogueEntry(slug);
  if (!entry) notFound();
  const { item, related, more } = entry;
  // Links their owner can take down (Drive, Docs, Notion) open our saved copy instead.
  const useCopy = item.href !== item.url;
  const cat = humanize(item.category);
  const domain = item.domain ?? new URL(item.url).hostname.replace(/^www\./, "");

  const base = env.APP_URL;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": CREATIVE.has(item.kind) ? "CreativeWork" : "SoftwareApplication",
      name: item.name,
      description: item.summary,
      url: item.url,
      mainEntityOfPage: `${base}/explore/${item.slug}`,
      ...(CREATIVE.has(item.kind) ? { genre: cat } : { applicationCategory: cat }),
      ...(item.tags.length ? { keywords: item.tags.join(", ") } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Catalogue", item: `${base}/explore` },
        { "@type": "ListItem", position: 2, name: cat, item: `${base}/explore?category=${item.category}` },
        { "@type": "ListItem", position: 3, name: item.name, item: `${base}/explore/${item.slug}` },
      ],
    },
  ];

  const facts: { k: string; v: React.ReactNode }[] = [];
  facts.push({ k: "Type", v: humanize(item.kind) });
  facts.push({ k: "Category", v: cat });
  facts.push({
    k: "Verified link",
    v: (
      <span className="tp-ok">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8.5l3.2 3.2L13 4.8" />
        </svg>
        Checked
      </span>
    ),
  });
  facts.push({ k: "First found", v: fmtDate(item.firstSeen) });
  if (item.saves > 1) facts.push({ k: "Saved by", v: `${item.saves} people` });

  return (
    <article className="tp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <header className="tp-head">
        <div className="lp-wrap">
          <nav aria-label="Breadcrumb" className="tp-crumbs lp-label">
            <Link href="/explore">Catalogue</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/explore?category=${item.category}`}>{cat}</Link>
          </nav>
          <p className="lp-label tp-kind">{humanize(item.kind)}</p>
          <h1 className="lp-display tp-name">{item.name}</h1>
          <p className="tp-summary">{item.summary}</p>
          <div className="tp-actions">
            {useCopy ? (
              <MagneticButton href={`/explore/${item.slug}/files`} label="Open the saved copy" icon="arrow" />
            ) : (
              <MagneticButton external href={item.url} label={`Open ${domain}`} icon="arrow" />
            )}
            {useCopy ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="lp-link">
                Original on {domain} <span aria-hidden="true">&#8599;</span>
              </a>
            ) : (
              <Link href="/explore" className="lp-link">
                <span className="lp-arrow" aria-hidden="true">&larr;</span> Back to the catalogue
              </Link>
            )}
          </div>
          <dl className="tp-facts">
            {facts.map((f, i) => (
              <div key={f.k} className="tp-fact" style={{ ["--i" as string]: i }}>
                <dt className="lp-label">{f.k}</dt>
                <dd className="lp-mono">{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {(item.useCases.length > 0 || item.tags.length > 0 || item.sources.length > 0 || related.length > 0) && (
        <section className="tp-sec tp-body">
          <div className="lp-wrap tp-grid">
            <div className="tp-main">
              {item.useCases.length > 0 && (
                <>
                  <h2 className="lp-label">Use it for</h2>
                  <ul className="tp-uses">
                    {item.useCases.map((u) => (
                      <li key={u}>
                        <span className="tp-mark" aria-hidden="true">&#8627;</span>
                        <span>{u.charAt(0).toUpperCase() + u.slice(1)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {item.tags.length > 0 && (
                <ul className="tp-tags" aria-label="Tags">
                  {item.tags.map((t) => (
                    <li key={t}>
                      <Link href={`/explore?q=${encodeURIComponent(t.replace(/-/g, " "))}`} className="tp-chip">
                        #{t}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <aside className="tp-side">
              <Sources sources={item.sources} />
              {related.length > 0 && (
                <div className="tp-box">
                  <h2 className="lp-label">From the same post</h2>
                  <ul className="tp-rel">
                    {related.map((r) => (
                      <li key={r.slug}>
                        <Link href={`/explore/${r.slug}`} className="tp-rel-row">
                          <span className="tp-rel-name">{r.name}</span>
                          <span className="tp-rel-dom lp-mono">{r.domain}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="tp-sec">
          <div className="lp-wrap">
            <h2 className="lp-label">More in {cat.toLowerCase()}</h2>
            <ul className="tp-more">
              {more.map((m) => (
                <li key={m.slug}>
                  <Spotlight className="tp-more-card">
                    <Link href={`/explore/${m.slug}`} className="tp-more-link">
                      <span className="tp-more-name">{m.name}</span>
                      <span className="tp-more-sum">{m.summary}</span>
                      <span className="tp-more-dom lp-mono">{m.domain}</span>
                    </Link>
                  </Spotlight>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}

function Sources({ sources }: { sources: CatalogueEntry["sources"] }) {
  if (!sources.length) return null;
  return (
    <div className="tp-box">
      <h2 className="lp-label">Found in</h2>
      <ul className="tp-src">
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="tp-src-row">
              <span className="tp-src-av" aria-hidden="true">
                {(s.creator ?? s.platform).replace(/^@/, "").charAt(0).toUpperCase()}
              </span>
              <span className="tp-src-main">
                <b>{s.creator ? `@${s.creator.replace(/^@/, "")}` : `${s.platform} post`}</b>
                <span className="lp-mono tp-src-date">
                  {s.platform} · {fmtDate(s.date)}
                </span>
              </span>
              <span className="tp-src-open" aria-hidden="true">&#8599;</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="tp-credit">Credit goes to the creator whose post put it on our radar.</p>
    </div>
  );
}

function ToolSkeleton() {
  return (
    <div className="tp" aria-busy="true">
      <div className="tp-head">
        <div className="lp-wrap">
          <div className="tp-sk" style={{ width: 180, height: 12 }} />
          <div className="tp-sk" style={{ width: "55%", height: 84, marginTop: 28 }} />
          <div className="tp-sk" style={{ width: "70%", maxWidth: 560, height: 18, marginTop: 28 }} />
          <div className="tp-sk" style={{ width: "50%", maxWidth: 400, height: 18, marginTop: 10 }} />
          <div className="tp-sk" style={{ width: 220, height: 52, borderRadius: 999, marginTop: 36 }} />
          <div className="tp-sk" style={{ width: "100%", height: 72, borderRadius: 12, marginTop: 56 }} />
        </div>
      </div>
      <div className="tp-sec">
        <div className="lp-wrap">
          {[0, 1, 2].map((i) => (
            <div key={i} className="tp-sk" style={{ width: `${80 - i * 12}%`, height: 28, marginTop: 24 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
