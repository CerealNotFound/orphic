// Full private copy of a public Notion site. Starting from the shared page, it follows everything a reader can open
// (sub-pages, "link to page" blocks, page mentions, links to other pages of the same site, database rows, synced blocks)
// and downloads every image, video, audio file and attachment. Uses Notion's public page API (no login, no extra deps).
//
// Output: one self-contained HTML copy (all pages, working links between them, media shown from Orphic's own copies),
// a Markdown copy of all the text, and every file. File links are written as {{orphic-file:N}} placeholders
// (N = index in `files`); the uploader swaps them for the saved copies' addresses.
import { safeFetch } from "./safety";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_PAGES = 300;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // the server's limit for one saved copy
const MAX_TOTAL_BYTES = 3 * 1024 * 1024 * 1024;

type Rich = [string, (string | unknown)[][]?][];
type Block = {
  id: string;
  type: string;
  space_id?: string;
  parent_id?: string;
  content?: string[];
  properties?: Record<string, Rich>;
  format?: Record<string, unknown>;
  collection_id?: string;
  view_ids?: string[];
};
type Collection = { id: string; name?: Rich; schema?: Record<string, { name: string; type: string }> };

export type NotionFile = { name: string; kind: "image" | "video" | "audio" | "file"; source: string; data?: Buffer; type?: string; error?: string };
export type NotionCopy = { title: string; url: string; pages: { id: string; title: string; url: string }[]; files: NotionFile[]; markdown: string; html: string; warnings: string[] };

const dashed = (id: string) => {
  const h = id.replace(/-/g, "").toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const ID_RE = /(?:^|[^0-9a-f])([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![0-9a-f])/i;

/** The page id and API origin of a public Notion link, or null if it isn't one. */
export function notionPage(url: string): { origin: string; id: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!/(^|\.)notion\.(site|so|com)$/.test(host)) return null;
  const m = u.pathname.match(ID_RE) ?? (u.searchParams.get("p") ?? "").match(ID_RE);
  return m ? { origin: u.origin, id: dashed(m[1]) } : null;
}

const unwrap = <T>(rec: unknown): T | null => {
  const v = (rec as { value?: { value?: unknown } } | undefined)?.value;
  return ((v && typeof v === "object" && "value" in v && v.value ? v.value : v) as T) ?? null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = (r: Rich | undefined) => (r ?? []).map((s) => s[0]).join("");
const safeHref = (h: string) => (/^(https?:|mailto:)/i.test(h) ? h : null);

export async function copyNotionSite(startUrl: string, log: (t: string) => void = () => {}): Promise<NotionCopy> {
  const start = notionPage(startUrl);
  if (!start) throw new Error("not a Notion page link");
  const { origin } = start;
  const blocks = new Map<string, Block>();
  const collections = new Map<string, Collection>();
  const warnings: string[] = [];

  async function api<T>(endpoint: string, body: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${origin}/api/v3/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": UA },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });
      const text = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok || text.trimStart().startsWith("<")) throw new Error(`Notion ${endpoint} answered ${res.status}`);
      return JSON.parse(text) as T;
    }
  }
  const absorb = (rm: { block?: Record<string, unknown>; collection?: Record<string, unknown> } | undefined) => {
    for (const [id, rec] of Object.entries(rm?.block ?? {})) {
      const b = unwrap<Block>(rec);
      if (b?.type) blocks.set(id, b);
    }
    for (const [id, rec] of Object.entries(rm?.collection ?? {})) {
      const c = unwrap<Collection>(rec);
      if (c) collections.set(id, c);
    }
  };
  async function fetchRecords(table: "block" | "collection", ids: string[]) {
    for (let i = 0; i < ids.length; i += 100) {
      const r = await api<{ recordMap?: Parameters<typeof absorb>[0] }>("syncRecordValuesMain", {
        requests: ids.slice(i, i + 100).map((id) => ({ pointer: { table, id }, version: -1 })),
      });
      absorb(r.recordMap);
    }
  }
  async function loadPage(id: string) {
    let cursor: { stack: unknown[] } = { stack: [] };
    for (let chunk = 0; chunk < 60; chunk++) {
      const r = await api<{ recordMap?: Parameters<typeof absorb>[0]; cursor?: { stack: unknown[] } }>("loadPageChunk", {
        pageId: id, limit: 100, cursor, chunkNumber: chunk, verticalColumns: false,
      });
      absorb(r.recordMap);
      cursor = r.cursor ?? { stack: [] };
      if (!cursor.stack?.length) break;
    }
    // Fill in anything the chunks left out (deep nesting, synced blocks) until the whole tree is here.
    for (let round = 0; round < 12; round++) {
      const missing = new Set<string>();
      walk(id, (b) => {
        for (const c of b.content ?? []) if (!blocks.has(c)) missing.add(c);
        const ptr = (b.format?.transclusion_reference_pointer as { id?: string } | undefined)?.id;
        if (ptr && !blocks.has(ptr)) missing.add(ptr);
      });
      if (!missing.size) break;
      await fetchRecords("block", [...missing]);
      if ([...missing].every((m) => !blocks.has(m))) break; // not public
    }
  }
  /** Visits a page's blocks (not into other pages), following synced blocks to their content. */
  function walk(pageId: string, fn: (b: Block) => void) {
    const seen = new Set<string>();
    const visit = (id: string, top: boolean) => {
      const b = blocks.get(id);
      if (!b || seen.has(id)) return;
      seen.add(id);
      fn(b);
      if (!top && (b.type === "page" || b.type === "collection_view_page")) return;
      const ptr = (b.format?.transclusion_reference_pointer as { id?: string } | undefined)?.id;
      if (ptr) visit(ptr, false);
      for (const c of b.content ?? []) visit(c, false);
    };
    visit(pageId, true);
  }

  // --- crawl ---------------------------------------------------------------------------------------------
  const rootId = start.id;
  await loadPage(rootId);
  const root = blocks.get(rootId);
  if (!root) throw new Error("the Notion page isn't public (or was removed)");
  const space = root.space_id;
  const order: string[] = [];
  const queued = new Set<string>([rootId]);
  const queue = [rootId];
  const collectionRows = new Map<string, string[]>(); // block id of a database → row page ids
  const enqueue = (id: string | undefined) => {
    if (!id || queued.has(id)) return;
    queued.add(id);
    queue.push(id);
  };
  const linkedPageId = (href: string): string | null => {
    if (href.startsWith("/")) href = origin + href;
    const p = notionPage(href);
    return p ? p.id : null;
  };

  while (queue.length) {
    const id = queue.shift()!;
    if (order.length >= MAX_PAGES) {
      warnings.push(`Stopped after ${MAX_PAGES} pages; ${queue.length + 1} more were not copied.`);
      break;
    }
    if (id !== rootId) {
      try {
        await loadPage(id);
      } catch (err) {
        warnings.push(`Couldn't open a linked page (${id}): ${String(err)}`);
        continue;
      }
    }
    const page = blocks.get(id);
    if (!page) continue;
    if (page.space_id && space && page.space_id !== space) continue; // a different workspace: keep it as a plain link
    order.push(id);
    log(`Notion: page ${order.length}: ${plain(page.properties?.title) || "Untitled"}`);
    const scanRich = (r: Rich | undefined) => {
      for (const [, ann] of r ?? []) {
        for (const a of ann ?? []) {
          if (a[0] === "p" && typeof a[1] === "string") enqueue(dashed(a[1]));
          if (a[0] === "a" && typeof a[1] === "string") enqueue(linkedPageId(a[1]) ?? undefined);
        }
      }
    };
    const dbs: Block[] = [];
    walk(id, (b) => {
      if (b.id !== id && (b.type === "page" || b.type === "collection_view_page")) enqueue(b.id);
      if (b.type === "alias") enqueue((b.format?.alias_pointer as { id?: string } | undefined)?.id);
      if (b.type === "collection_view" || b.type === "collection_view_page") dbs.push(b);
      for (const r of Object.values(b.properties ?? {})) scanRich(r);
    });
    for (const db of dbs) {
      const cid = db.collection_id ?? (db.format?.collection_pointer as { id?: string } | undefined)?.id;
      const vid = db.view_ids?.[0];
      if (!cid || !vid) continue;
      try {
        if (!collections.has(cid)) await fetchRecords("collection", [cid]);
        const r = await api<{ result?: { reducerResults?: { collection_group_results?: { blockIds?: string[] } } }; recordMap?: Parameters<typeof absorb>[0] }>(
          "queryCollection",
          {
            collection: { id: cid, spaceId: db.space_id },
            collectionView: { id: vid, spaceId: db.space_id },
            loader: { type: "reducer", reducers: { collection_group_results: { type: "results", limit: 1000 } }, searchQuery: "", userTimeZone: "UTC" },
          },
        );
        absorb(r.recordMap);
        const rows = r.result?.reducerResults?.collection_group_results?.blockIds ?? [];
        collectionRows.set(db.id, rows);
        rows.forEach((row) => enqueue(row));
      } catch (err) {
        warnings.push(`Couldn't read a database on "${plain(page.properties?.title)}": ${String(err)}`);
      }
    }
  }
  const inCopy = new Set(order);

  // --- files ---------------------------------------------------------------------------------------------
  const files: NotionFile[] = [];
  const fileIndex = new Map<string, number>(); // block id → index
  const sourceIndex = new Map<string, number>();
  const pending: { blockId: string; source: string; i: number }[] = [];
  const addFile = (blockId: string, kind: NotionFile["kind"], source: string, name: string) => {
    if (sourceIndex.has(source)) return void fileIndex.set(blockId, sourceIndex.get(source)!);
    const i = files.push({ name, kind, source }) - 1;
    sourceIndex.set(source, i);
    fileIndex.set(blockId, i);
    pending.push({ blockId, source, i });
  };
  const MEDIA: Record<string, NotionFile["kind"]> = { image: "image", video: "video", audio: "audio", file: "file", pdf: "file" };
  const isNotionFile = (s: string) => s.startsWith("attachment:") || /secure\.notion-static\.com|prod-files-secure|file\.notion\.(so|com)/.test(s);
  for (const pid of order) {
    walk(pid, (b) => {
      const kind = MEDIA[b.type];
      const cover = b.id === pid ? (b.format?.page_cover as string | undefined) : undefined;
      if (cover && (isNotionFile(cover) || /^https?:/.test(cover))) addFile(`${b.id}:cover`, "image", cover, fileName(cover, "cover"));
      if (!kind) return;
      const src = b.properties?.source?.[0]?.[0] ?? (b.format?.display_source as string | undefined);
      if (!src) return;
      // Videos on YouTube/Vimeo/Loom aren't files; keep those as links.
      if (!isNotionFile(src) && kind === "video" && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(src)) return;
      if (!isNotionFile(src) && !/^https?:/i.test(src)) return;
      addFile(b.id, kind, src, plain(b.properties?.title) || fileName(src, b.type));
    });
  }
  // Notion's own uploads need short-lived signed links.
  const toSign = pending.filter((p) => isNotionFile(p.source));
  const signed = new Map<number, string>();
  for (let i = 0; i < toSign.length; i += 50) {
    const batch = toSign.slice(i, i + 50);
    try {
      const r = await api<{ signedUrls?: (string | null)[] }>("getSignedFileUrls", {
        urls: batch.map((p) => ({ url: p.source, permissionRecord: { table: "block", id: p.blockId.replace(/:cover$/, ""), spaceId: space } })),
      });
      batch.forEach((p, j) => r.signedUrls?.[j] && signed.set(p.i, r.signedUrls[j]!));
    } catch (err) {
      warnings.push(`Couldn't get download links for ${batch.length} file(s): ${String(err)}`);
    }
  }
  let total = 0;
  const work = [...pending];
  const worker = async () => {
    for (let p = work.shift(); p; p = work.shift()) {
      const f = files[p.i];
      const url = signed.get(p.i) ?? (isNotionFile(p.source) ? null : p.source);
      if (!url) {
        f.error = "no download link";
        continue;
      }
      try {
        const res = await safeFetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(300_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
        if (type.includes("html")) throw new Error("the link is a web page, not a file");
        const len = Number(res.headers.get("content-length") || 0);
        if (len > MAX_FILE_BYTES) throw new Error(`too big (${Math.round(len / 1048576)} MB)`);
        const data = Buffer.from(await res.arrayBuffer());
        if (data.length > MAX_FILE_BYTES) throw new Error(`too big (${Math.round(data.length / 1048576)} MB)`);
        if (total + data.length > MAX_TOTAL_BYTES) throw new Error("the copy reached its total size limit");
        total += data.length;
        f.data = data;
        f.type = type;
        log(`Notion: file ${f.name} (${Math.max(1, Math.round(data.length / 1024))} KB)`);
      } catch (err) {
        f.error = err instanceof Error ? err.message : String(err);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  for (const f of files) if (f.error) warnings.push(`Not saved: ${f.name} (${f.error})`);

  // --- render --------------------------------------------------------------------------------------------
  const title = plain(root.properties?.title) || "Notion page";
  const pageTitle = (id: string) => plain(blocks.get(id)?.properties?.title) || "Untitled";
  const pageUrl = (id: string) => `${origin}/${id.replace(/-/g, "")}`;
  const placeholder = (i: number) => `{{orphic-file:${i}}}`;

  /** Link "chips" (rich previews of GitHub, YouTube, sites): `lm` carries the link inline, `eoi` points at a block. */
  function mention(k: string, v: unknown): { href: string; title: string } | null {
    if (k === "lm" && v && typeof v === "object") {
      const m = v as { href?: string; title?: string };
      return m.href ? { href: m.href, title: m.title || m.href } : null;
    }
    if (k === "eoi" && typeof v === "string") {
      const f = blocks.get(v)?.format as { original_url?: string; uri?: string } | undefined;
      const href = f?.original_url ?? f?.uri;
      return href ? { href, title: href.replace(/^https?:\/\/(www\.)?/, "") } : null;
    }
    return null;
  }

  function richHtml(r: Rich | undefined): string {
    return (r ?? [])
      .map(([text, ann = []]) => {
        let out = esc(text);
        for (const a of ann) {
          const [k, v] = a as [string, unknown];
          if (k === "p" && typeof v === "string") {
            const pid = dashed(v);
            out = inCopy.has(pid) ? `<a href="#p-${pid}">${esc(pageTitle(pid))}</a>` : `<a href="${esc(pageUrl(pid))}">${esc(pageTitle(pid))}</a>`;
          } else if (mention(k, v)) {
            const m = mention(k, v)!;
            out = safeHref(m.href) ? `<a href="${esc(m.href)}">${esc(m.title)}</a>` : esc(m.title);
          } else if (k === "d" && v && typeof v === "object") out = esc(String((v as { start_date?: string }).start_date ?? text));
          else if (k === "u") out = "@someone";
          else if (k === "e" && typeof v === "string") out = `<code>${esc(v)}</code>`;
          else if (k === "b") out = `<strong>${out}</strong>`;
          else if (k === "i") out = `<em>${out}</em>`;
          else if (k === "s") out = `<s>${out}</s>`;
          else if (k === "_") out = `<u>${out}</u>`;
          else if (k === "c") out = `<code>${out}</code>`;
        }
        const link = ann.find((a) => a[0] === "a")?.[1];
        if (typeof link === "string") {
          const pid = linkedPageId(link);
          if (pid && inCopy.has(pid)) out = `<a href="#p-${pid}">${out}</a>`;
          else if (safeHref(link.startsWith("/") ? origin + link : link)) out = `<a href="${esc(link.startsWith("/") ? origin + link : link)}">${out}</a>`;
        }
        return out;
      })
      .join("");
  }
  function richMd(r: Rich | undefined): string {
    return (r ?? [])
      .map(([text, ann = []]) => {
        let out = text;
        for (const a of ann) {
          const [k, v] = a as [string, unknown];
          if (k === "p" && typeof v === "string") out = `“${pageTitle(dashed(v))}”`;
          else if (mention(k, v)) out = `[${mention(k, v)!.title}](${mention(k, v)!.href})`;
          else if (k === "d" && v && typeof v === "object") out = String((v as { start_date?: string }).start_date ?? text);
          else if (k === "u") out = "@someone";
          else if (k === "e" && typeof v === "string") out = `$${v}$`;
          else if (k === "b" && out.trim()) out = `**${out}**`;
          else if (k === "i" && out.trim()) out = `*${out}*`;
          else if (k === "c") out = `\`${out}\``;
        }
        const link = ann.find((a) => a[0] === "a")?.[1];
        if (typeof link === "string") {
          const pid = linkedPageId(link);
          out = pid && inCopy.has(pid) ? `${out} (see page “${pageTitle(pid)}”)` : `[${out}](${link.startsWith("/") ? origin + link : link})`;
        }
        return out;
      })
      .join("");
  }

  function mediaHtml(b: Block, i: number | undefined): string {
    const caption = richHtml(b.properties?.caption);
    const f = i === undefined ? null : files[i];
    const name = esc(f?.name ?? plain(b.properties?.title) ?? b.type);
    let inner: string;
    if (!f || !f.data) {
      const src = b.properties?.source?.[0]?.[0] ?? "";
      inner = safeHref(src) ? `<a href="${esc(src)}">${esc(src)}</a>` : `<span class="muted">${name} (couldn't be saved)</span>`;
    } else if (f.kind === "image") inner = `<img src="${placeholder(i!)}" alt="${esc(plain(b.properties?.caption) || f.name)}" loading="lazy">`;
    else if (f.kind === "video") inner = `<video controls preload="metadata" src="${placeholder(i!)}"></video><br><a href="${placeholder(i!)}">⬇ ${name}</a>`;
    else if (f.kind === "audio") inner = `<audio controls preload="none" src="${placeholder(i!)}"></audio><br><a href="${placeholder(i!)}">⬇ ${name}</a>`;
    else inner = `<a class="file" href="${placeholder(i!)}">📎 ${name}</a>`;
    return `<figure>${inner}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  }
  function mediaMd(b: Block, i: number | undefined): string {
    const f = i === undefined ? null : files[i];
    const cap = plain(b.properties?.caption);
    if (!f || !f.data) return `[${b.type}: ${b.properties?.source?.[0]?.[0] ?? "not saved"}]${cap ? ` ${cap}` : ""}`;
    return `[${f.kind}: ${f.name}](${placeholder(i!)})${cap ? ` ${cap}` : ""}`;
  }

  function rowProps(rowId: string, cid: string | undefined): string[][] {
    const schema = (cid && collections.get(cid)?.schema) || {};
    const row = blocks.get(rowId);
    return Object.entries(schema)
      .filter(([k]) => k !== "title")
      .map(([k, s]) => [s.name, plain(row?.properties?.[k])])
      .filter(([, v]) => v);
  }

  function renderChildren(ids: string[] | undefined, depth: number): { html: string; md: string } {
    let html = "";
    let md = "";
    const list = ids ?? [];
    for (let n = 0; n < list.length; n++) {
      const b = blocks.get(list[n]);
      if (!b) continue;
      if (b.type === "bulleted_list" || b.type === "numbered_list") {
        const tag = b.type === "bulleted_list" ? "ul" : "ol";
        let items = "";
        let k = 0;
        for (; n < list.length && blocks.get(list[n])?.type === b.type; n++) {
          const it = blocks.get(list[n])!;
          const kids = renderChildren(it.content, depth + 1);
          items += `<li>${richHtml(it.properties?.title)}${kids.html}</li>`;
          md += `${"  ".repeat(depth)}${tag === "ul" ? "-" : `${++k}.`} ${richMd(it.properties?.title)}\n${kids.md}`;
        }
        n--;
        html += `<${tag}>${items}</${tag}>`;
        continue;
      }
      const r = renderBlock(b, depth);
      html += r.html;
      md += r.md;
    }
    return { html, md };
  }

  function renderBlock(b: Block, depth: number): { html: string; md: string } {
    const t = b.properties?.title;
    const kids = () => renderChildren(b.content, depth + 1);
    const pad = "  ".repeat(depth);
    switch (b.type) {
      case "text": {
        const k = kids();
        return { html: `<p>${richHtml(t) || "&nbsp;"}</p>${k.html ? `<div class="indent">${k.html}</div>` : ""}`, md: `${pad}${richMd(t)}\n\n${k.md}` };
      }
      case "header":
      case "sub_header":
      case "sub_sub_header": {
        // Headings can be collapsible, with the real content inside: always include it, shown open.
        const level = b.type === "header" ? 2 : b.type === "sub_header" ? 3 : 4;
        const k = kids();
        const h = `<h${level}>${richHtml(t)}</h${level}>`;
        return {
          html: k.html ? `<details open><summary>${h}</summary><div class="indent">${k.html}</div></details>` : h,
          md: `\n${"#".repeat(level)} ${richMd(t)}\n\n${k.md}`,
        };
      }
      case "to_do": {
        const done = plain(b.properties?.checked) === "Yes";
        const k = kids();
        return { html: `<p class="todo">${done ? "☑" : "☐"} ${richHtml(t)}</p>${k.html ? `<div class="indent">${k.html}</div>` : ""}`, md: `${pad}- [${done ? "x" : " "}] ${richMd(t)}\n${k.md}` };
      }
      case "toggle": {
        const k = kids();
        return { html: `<details open><summary>${richHtml(t)}</summary><div class="indent">${k.html}</div></details>`, md: `${pad}▸ ${richMd(t)}\n${k.md}\n` };
      }
      case "quote": {
        const k = kids();
        return { html: `<blockquote>${richHtml(t)}${k.html}</blockquote>`, md: `> ${richMd(t)}\n${k.md}\n` };
      }
      case "callout": {
        const icon = typeof b.format?.page_icon === "string" && !/^https?:|^\//.test(b.format.page_icon) ? b.format.page_icon : "💡";
        const k = kids();
        return { html: `<div class="callout"><span>${esc(icon)}</span><div>${richHtml(t)}${k.html}</div></div>`, md: `> ${icon} ${richMd(t)}\n${k.md.replace(/^/gm, "> ")}\n\n` };
      }
      case "code": {
        const lang = plain(b.properties?.language);
        return { html: `<pre><code>${esc(plain(t))}</code></pre>${b.properties?.caption ? `<p class="muted">${richHtml(b.properties.caption)}</p>` : ""}`, md: `\n\`\`\`${lang.toLowerCase().replace(/\s+/g, "")}\n${plain(t)}\n\`\`\`\n\n` };
      }
      case "equation":
        return { html: `<pre class="eq">${esc(plain(t))}</pre>`, md: `\n$$${plain(t)}$$\n\n` };
      case "divider":
        return { html: "<hr>", md: "\n---\n\n" };
      case "image":
      case "video":
      case "audio":
      case "file":
      case "pdf":
        return { html: mediaHtml(b, fileIndex.get(b.id)), md: `${pad}${mediaMd(b, fileIndex.get(b.id))}\n\n` };
      case "bookmark": {
        const link = plain(b.properties?.link);
        const name = plain(b.properties?.title) || link;
        const desc = plain(b.properties?.description);
        return {
          html: `<p class="bookmark">${safeHref(link) ? `<a href="${esc(link)}">${esc(name)}</a>` : esc(name)}${desc ? `<br><span class="muted">${esc(desc)}</span>` : ""}</p>`,
          md: `${pad}[${name}](${link})${desc ? ` ${desc}` : ""}\n\n`,
        };
      }
      case "page":
      case "collection_view_page":
      case "alias": {
        const pid = b.type === "alias" ? (b.format?.alias_pointer as { id?: string } | undefined)?.id : b.id;
        if (b.type === "collection_view_page" && pid && collectionRows.has(pid)) return renderDatabase(b, depth);
        if (!pid) return { html: "", md: "" };
        const label = esc(pageTitle(pid));
        return inCopy.has(pid)
          ? { html: `<p class="pagelink">📄 <a href="#p-${pid}">${label}</a></p>`, md: `${pad}📄 Page: “${pageTitle(pid)}” (below)\n\n` }
          : { html: `<p class="pagelink">📄 <a href="${esc(pageUrl(pid))}">${label}</a> <span class="muted">(not part of this site's copy)</span></p>`, md: `${pad}📄 [${pageTitle(pid)}](${pageUrl(pid)})\n\n` };
      }
      case "collection_view":
        return renderDatabase(b, depth);
      case "table": {
        const cols = (b.format?.table_block_column_order as string[] | undefined) ?? [];
        const header = Boolean(b.format?.table_block_column_header);
        const rows = (b.content ?? []).map((id) => blocks.get(id)).filter((x): x is Block => Boolean(x));
        const html = `<table>${rows.map((r, i) => `<tr>${cols.map((c) => (i === 0 && header ? `<th>${richHtml(r.properties?.[c])}</th>` : `<td>${richHtml(r.properties?.[c])}</td>`)).join("")}</tr>`).join("")}</table>`;
        const md = rows.map((r, i) => `| ${cols.map((c) => richMd(r.properties?.[c]).replace(/\|/g, "\\|")).join(" | ")} |${i === 0 ? `\n|${cols.map(() => " --- |").join("")}` : ""}`).join("\n");
        return { html, md: `\n${md}\n\n` };
      }
      case "column_list": {
        const cols = (b.content ?? []).map((id) => renderChildren(blocks.get(id)?.content, depth));
        return { html: `<div class="cols">${cols.map((c) => `<div>${c.html}</div>`).join("")}</div>`, md: cols.map((c) => c.md).join("\n") };
      }
      case "transclusion_container":
        return kids();
      case "transclusion_reference": {
        const ptr = (b.format?.transclusion_reference_pointer as { id?: string } | undefined)?.id;
        return ptr ? renderChildren(blocks.get(ptr)?.content, depth) : { html: "", md: "" };
      }
      case "table_of_contents":
      case "breadcrumb":
        return { html: "", md: "" };
      default: {
        const src = b.properties?.source?.[0]?.[0] ?? (b.format?.display_source as string | undefined);
        const k = kids();
        const head = t ? richHtml(t) : "";
        const link = src && safeHref(src) ? `<a href="${esc(src)}">${esc(src)}</a>` : "";
        return { html: `${head || link ? `<p>${head}${head && link ? "<br>" : ""}${link}</p>` : ""}${k.html}`, md: `${t ? `${pad}${richMd(t)}\n` : ""}${src ? `${pad}${src}\n` : ""}\n${k.md}` };
      }
    }
  }

  function renderDatabase(b: Block, depth: number): { html: string; md: string } {
    const cid = b.collection_id ?? (b.format?.collection_pointer as { id?: string } | undefined)?.id;
    const rows = collectionRows.get(b.id) ?? [];
    const name = plain(cid ? collections.get(cid)?.name : undefined) || "Database";
    const items = rows.map((r) => {
      const props = rowProps(r, cid);
      const label = esc(pageTitle(r));
      return {
        html: `<li>${inCopy.has(r) ? `<a href="#p-${r}">${label}</a>` : label}${props.length ? ` <span class="muted">${props.map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ")}</span>` : ""}</li>`,
        md: `${"  ".repeat(depth)}- ${pageTitle(r)}${props.length ? ` (${props.map(([k, v]) => `${k}: ${v}`).join("; ")})` : ""}\n`,
      };
    });
    return { html: `<h3>🗂 ${esc(name)}</h3><ul class="db">${items.map((i) => i.html).join("")}</ul>`, md: `\n### ${name}\n\n${items.map((i) => i.md).join("")}\n` };
  }

  const savedOn = new Date().toISOString().slice(0, 10);
  const sections = order.map((pid) => {
    const p = blocks.get(pid)!;
    const icon = typeof p.format?.page_icon === "string" && !/^https?:|^\//.test(p.format.page_icon) ? `${p.format.page_icon} ` : "";
    const coverI = fileIndex.get(`${pid}:cover`);
    const cover = coverI !== undefined && files[coverI].data ? `<img class="cover" src="${placeholder(coverI)}" alt="">` : "";
    const body = p.type === "collection_view_page" ? renderDatabase(p, 0) : renderChildren(p.content, 0);
    const rowInfo = rowProps(pid, p.parent_id ? blocks.get(p.parent_id)?.collection_id : undefined);
    return {
      html: `<section id="p-${pid}">${cover}<h1>${esc(icon)}${esc(pageTitle(pid))}</h1><p class="muted">Original: <a href="${esc(pageUrl(pid))}">${esc(pageUrl(pid))}</a></p>${body.html}</section>`,
      md: `# ${icon}${pageTitle(pid)}\n\nOriginal: ${pageUrl(pid)}\n${rowInfo.length ? rowInfo.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" : ""}\n${body.md.replace(/\n{3,}/g, "\n\n")}`,
    };
  });
  const toc =
    order.length > 1
      ? `<nav><strong>${order.length} pages in this copy</strong><ol>${order.map((pid) => `<li><a href="#p-${pid}">${esc(pageTitle(pid))}</a></li>`).join("")}</ol></nav>`
      : "";
  const savedFiles = files.filter((f) => f.data).length;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} (saved copy)</title>
<style>
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2328;max-width:860px;margin:0 auto;padding:24px}
@media (prefers-color-scheme:dark){body{background:#16171a;color:#e6e6e6}a{color:#8ab4ff}pre,code,.callout,nav{background:#24262b!important}th,td{border-color:#3a3d44!important}}
a{color:#2563eb}h1{font-size:2em;margin:1.2em 0 .2em}section+section{border-top:3px solid #d0d7de;margin-top:3em}
.banner{background:#fff4d6;color:#5c4400;border-radius:10px;padding:10px 14px;font-size:14px}
nav{background:#f6f8fa;border-radius:10px;padding:10px 16px;margin:16px 0}.muted{color:#6e7781;font-size:14px}
pre{background:#f6f8fa;border-radius:8px;padding:12px;overflow:auto;white-space:pre-wrap}code{background:#f6f8fa;border-radius:4px;padding:0 3px}pre code{padding:0}
.callout{display:flex;gap:10px;background:#f6f8fa;border-radius:10px;padding:12px;margin:12px 0}
blockquote{border-left:3px solid #d0d7de;margin:0;padding-left:14px}img,video{max-width:100%;border-radius:8px}img.cover{width:100%;max-height:260px;object-fit:cover}
figure{margin:16px 0}figcaption{color:#6e7781;font-size:14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:6px 8px;text-align:left;vertical-align:top}
.indent{margin-left:24px}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}details summary{cursor:pointer;font-weight:600}summary>h2,summary>h3,summary>h4{display:inline}
</style></head><body>
<p class="banner">🔒 Private copy saved by Orphic on ${savedOn} from <a href="${esc(startUrl)}">${esc(startUrl)}</a>. It has ${order.length} ${order.length === 1 ? "page" : "pages"} and ${savedFiles} ${savedFiles === 1 ? "file" : "files"}, and it keeps working if the original is taken down.</p>
${toc}
${sections.map((s) => s.html).join("\n")}
</body></html>`;
  const markdown =
    `<!-- Saved by Orphic on ${savedOn} from ${startUrl}: ${order.length} page(s), ${savedFiles} file(s) -->\n\n` +
    (order.length > 1 ? `Pages in this copy:\n${order.map((pid, i) => `${i + 1}. ${pageTitle(pid)}`).join("\n")}\n\n---\n\n` : "") +
    sections.map((s) => s.md).join("\n\n---\n\n");
  return { title, url: startUrl, pages: order.map((id) => ({ id, title: pageTitle(id), url: pageUrl(id) })), files, markdown, html, warnings };
}

function fileName(src: string, fallback: string): string {
  const att = src.match(/^attachment:[\w-]+:(.+)$/);
  if (att) return att[1];
  try {
    const last = decodeURIComponent(new URL(src).pathname.split("/").pop() ?? "");
    return last || fallback;
  } catch {
    return fallback;
  }
}
