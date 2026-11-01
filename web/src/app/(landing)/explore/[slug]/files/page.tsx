// /explore/<slug>/files: our saved copy of a link its owner could take down (a Drive folder, a Google Doc, a Notion
// page). The page itself is shown when there is one; every file is listed in its folders, to play, open or download.
import type { Metadata } from "next";
import { Gloock } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { publicCopy, publicFileUrl, slugsWithFiles, type PublicFile } from "@/lib/public-files";
import { Nav } from "../../../_sections/nav";
import { Footer } from "../../../_sections/open-source";
import { PageFrame } from "./page-frame";
import "../../../landing.css";
import "./files.css";

const display = Gloock({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });

export async function generateStaticParams() {
  const slugs = await slugsWithFiles();
  return (slugs.length ? slugs : ["_"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/explore/[slug]/files">): Promise<Metadata> {
  const copy = await publicCopy((await params).slug);
  if (!copy) return { title: "Not found", robots: { index: false } };
  return {
    title: `${copy.name}: files`,
    description: `Saved copy of ${copy.name}. ${copy.summary}`,
    alternates: { canonical: `/explore/${copy.slug}/files` },
  };
}

export default function FilesPage({ params }: PageProps<"/explore/[slug]/files">) {
  return (
    <div className={`lp ${display.variable} min-h-full`}>
      <Nav />
      <main className="pt-16">
        <Suspense fallback={<div className="fv" aria-busy="true" />}>
          <Files params={params} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

// ---------- helpers ----------
const EXT: [RegExp, string][] = [
  [/pdf/, "PDF"],
  [/html/, "Web page"],
  [/markdown/, "Markdown"],
  [/^text\/plain/, "Text"],
  [/csv/, "CSV"],
  [/wav/, "WAV audio"],
  [/mpeg$|mp3/, "MP3 audio"],
  [/^audio\//, "Audio"],
  [/mp4/, "MP4 video"],
  [/quicktime/, "MOV video"],
  [/^video\//, "Video"],
  [/^image\//, "Image"],
  [/zip/, "ZIP"],
  [/spreadsheet|excel/, "Spreadsheet"],
  [/presentation|powerpoint/, "Slides"],
  [/word|document/, "Document"],
];
const typeLabel = (t: string) => EXT.find(([re]) => re.test(t))?.[1] ?? "File";
const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const viewable = (t: string) => /^(application\/pdf|text\/html|image\/|video\/|audio\/)/.test(t);

function sourceName(url: string) {
  if (/drive\.google\.com\/drive\/folders/.test(url)) return "Google Drive folder";
  if (/drive\.google\.com/.test(url)) return "Google Drive file";
  if (/docs\.google\.com\/document/.test(url)) return "Google Doc";
  if (/docs\.google\.com\/spreadsheets/.test(url)) return "Google Sheet";
  if (/docs\.google\.com\/presentation/.test(url)) return "Google Slides deck";
  if (/notion\.(so|site|com)/.test(url)) return "Notion page";
  if (/dropbox/.test(url)) return "Dropbox folder";
  return "page";
}

type Folder = { name: string; path: string; folders: Map<string, Folder>; files: PublicFile[]; count: number; bytes: number };
function buildTree(files: PublicFile[]): Folder {
  const root: Folder = { name: "", path: "", folders: new Map(), files: [], count: 0, bytes: 0 };
  for (const f of files) {
    const parts = f.name.split("/").filter(Boolean);
    let node = root;
    node.count++;
    node.bytes += f.size;
    for (const p of parts.slice(0, -1)) {
      if (!node.folders.has(p)) node.folders.set(p, { name: p, path: `${node.path}/${p}`, folders: new Map(), files: [], count: 0, bytes: 0 });
      node = node.folders.get(p)!;
      node.count++;
      node.bytes += f.size;
    }
    node.files.push(f);
  }
  return root;
}

// ---------- page ----------
async function Files({ params }: { params: PageProps<"/explore/[slug]/files">["params"] }) {
  const copy = await publicCopy((await params).slug);
  if (!copy) notFound();

  // Our own listing of a Drive folder is only an index of the files below: no need to show it.
  const files = copy.files.filter((f) => !(f.kind === "text" && f.source && /\/drive\/folders\//.test(f.source)));
  const main = files.filter((f) => !f.part);
  // Show the page itself for a Notion page or a doc. A Drive folder is just its files.
  const folder = /\/drive\/folders\//.test(copy.url);
  const page = folder ? undefined : (main.find((f) => f.type.startsWith("text/html")) ?? main.find((f) => f.type === "application/pdf"));
  const single = !page && !folder && main.length === 1 ? main[0] : null;
  const tree = buildTree(files.map((f) => (f.part ? { ...f, name: `Files in this page/${f.name}` } : f)));
  const total = files.reduce((s, f) => s + f.size, 0);
  const saved = files.reduce((d, f) => (f.savedAt < d ? f.savedAt : d), files[0]?.savedAt ?? new Date().toISOString());
  const what = sourceName(copy.url);

  return (
    <article className="fv">
      <header className="lp-wrap fv-head">
        <nav aria-label="Breadcrumb" className="fv-crumbs lp-label">
          <Link href="/explore">Catalogue</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/explore/${copy.slug}`}>{copy.name}</Link>
          <span aria-hidden="true">/</span>
          <span>Files</span>
        </nav>
        <h1 className="lp-display fv-title">{copy.name}</h1>
        <p className="fv-sub">
          A saved copy of the {what}, kept here so it stays available even if the original is taken down. Saved {fmtDate(saved)}.
        </p>
        <div className="fv-meta lp-mono">
          <span>
            {files.length} file{files.length === 1 ? "" : "s"} · {size(total)}
          </span>
          <a href={copy.url} target="_blank" rel="noopener noreferrer nofollow">
            Original link ↗
          </a>
          <Link href={`/explore/${copy.slug}`}>About this tool →</Link>
        </div>
      </header>

      {page && (
        <section className="lp-wrap fv-view" aria-label="Preview">
          <div className="fv-frame-bar lp-mono">
            <span>{page.name.split("/").pop()}</span>
            <span className="fv-frame-acts">
              <a href={publicFileUrl(page.id)} target="_blank" rel="noopener noreferrer">
                Open in a new tab ↗
              </a>
              <a href={publicFileUrl(page.id, true)}>Download ↓</a>
            </span>
          </div>
          {page.type.startsWith("text/html") ? (
            <PageFrame src={publicFileUrl(page.id)} title={`${copy.name} (saved copy)`} />
          ) : (
            <iframe className="fv-frame" src={publicFileUrl(page.id)} title={`${copy.name} (saved copy)`} />
          )}
        </section>
      )}
      {single && <Single f={single} />}

      <section className="lp-wrap fv-files" aria-label="Files">
        <p className="lp-label">All files</p>
        <div className="fv-table" role="list">
          <FolderBody node={tree} depth={0} />
        </div>
      </section>
    </article>
  );
}

function Single({ f }: { f: PublicFile }) {
  const src = publicFileUrl(f.id);
  if (f.type.startsWith("image/"))
    return (
      <section className="lp-wrap fv-view">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="fv-img" src={src} alt={f.name} />
      </section>
    );
  if (f.type.startsWith("video/"))
    return (
      <section className="lp-wrap fv-view">
        <video className="fv-video" src={src} controls preload="metadata" />
      </section>
    );
  return null;
}

function FolderBody({ node, depth }: { node: Folder; depth: number }) {
  return (
    <>
      {[...node.folders.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
        .map((f) => (
          <details key={f.path} className="fv-folder" open={depth === 0 && node.folders.size <= 3} role="listitem">
            <summary className="fv-row fv-row--folder" style={{ ["--d" as string]: depth }}>
              <span className="fv-chev" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </span>
              <Icon kind="folder" />
              <span className="fv-name">{f.name}</span>
              <span className="fv-type">
                {f.count} file{f.count === 1 ? "" : "s"}
              </span>
              <span className="fv-size">{size(f.bytes)}</span>
              <span className="fv-acts" />
            </summary>
            <FolderBody node={f} depth={depth + 1} />
          </details>
        ))}
      {node.files.map((f) => (
        <FileRow key={f.id} f={f} depth={depth} />
      ))}
    </>
  );
}

function FileRow({ f, depth }: { f: PublicFile; depth: number }) {
  const name = f.name.split("/").pop() || f.name;
  const audio = f.type.startsWith("audio/");
  const kind = audio ? "audio" : f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : f.type === "application/pdf" ? "pdf" : f.type.startsWith("text/html") ? "page" : "doc";
  return (
    <div className="fv-row" role="listitem" style={{ ["--d" as string]: depth }}>
      <span className="fv-chev" aria-hidden="true" />
      <Icon kind={kind} />
      <span className="fv-name">
        {viewable(f.type) && !audio ? (
          <a href={publicFileUrl(f.id)} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        ) : (
          name
        )}
        {audio && <audio className="fv-audio" src={publicFileUrl(f.id)} controls preload="none" />}
      </span>
      <span className="fv-type">{typeLabel(f.type)}</span>
      <span className="fv-size">{size(f.size)}</span>
      <span className="fv-acts">
        <a href={publicFileUrl(f.id, true)} className="fv-dl" aria-label={`Download ${name}`} title="Download">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" />
          </svg>
        </a>
      </span>
    </div>
  );
}

function Icon({ kind }: { kind: "folder" | "audio" | "video" | "image" | "pdf" | "page" | "doc" }) {
  const paths: Record<string, React.ReactNode> = {
    folder: <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />,
    audio: <path d="M6 11.5V4l6-1.5v7.5M6 11.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM12 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />,
    video: <path d="M2.5 4.5h8v7h-8zM10.5 7l3-2v6l-3-2" />,
    image: <path d="M2.5 3.5h11v9h-11zM2.5 10.5l3-3 3 3 2-2 3 3M10 6.5h.01" />,
    pdf: <path d="M4 2h5l3 3v9H4zM9 2v3h3M6 9h4M6 11h3" />,
    page: <path d="M2.5 3.5h11v9h-11zM2.5 6h11M5 8.5h6M5 10.5h4" />,
    doc: <path d="M4 2h5l3 3v9H4zM9 2v3h3" />,
  };
  return (
    <span className={`fv-icon fv-icon--${kind}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {paths[kind]}
      </svg>
    </span>
  );
}
