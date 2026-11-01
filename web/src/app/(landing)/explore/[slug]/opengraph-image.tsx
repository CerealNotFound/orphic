import { ImageResponse } from "next/og";
import { getPublicItem } from "@/lib/public-catalogue";

export const alt = "Orphic catalogue";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function gloock(text: string): Promise<ArrayBuffer | null> {
  "use cache";
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Gloock&text=${encodeURIComponent(text)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1" },
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getPublicItem(slug);
  const name = item?.name ?? "Orphic";
  const full = item?.summary ?? "The open catalogue of AI tools from reels.";
  const summary = full.length > 140 ? `${full.slice(0, 137).replace(/\s+\S*$/, "")}...` : full;
  const domain = item?.domain ?? "";
  const font = await gloock(`${name}${summary}${domain}orphic`);
  const fs = name.length > 26 ? 76 : name.length > 16 ? 108 : 140;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0B0A08", color: "#EDE6D9", padding: "64px 72px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, color: "#FF5A36" }}>{domain}</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: fs, lineHeight: 1, letterSpacing: -2, fontFamily: font ? "Gloock" : "sans-serif", fontWeight: 400 }}>{name}</div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 30, lineHeight: 1.35, color: "#A39A8C", maxWidth: 1000 }}>{summary}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, color: "#EDE6D9" }}>
          <div style={{ width: 14, height: 14, borderRadius: 14, background: "#FF5A36" }} />
          orphic
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Gloock", data: font, style: "normal", weight: 400 }] : undefined },
  );
}
