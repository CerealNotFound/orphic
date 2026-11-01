"use client";
// A saved web page (e.g. a Notion copy), shown in a locked-down frame (no scripts) that grows to fit its content,
// so the page scrolls as one instead of a box inside a box.
import { useRef, useState } from "react";

export function PageFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState<number | null>(null);
  const fit = () => {
    const doc = ref.current?.contentDocument;
    if (!doc?.documentElement) return;
    // The <html> box is as tall as its content (scrollHeight would be at least the frame's own height).
    const measure = () => setH(Math.ceil(doc.documentElement.getBoundingClientRect().height) + 2);
    measure();
    // Images arrive after load: measure again as they do.
    doc.querySelectorAll("img, video").forEach((m) => m.addEventListener("load", measure, { once: true }));
  };
  return (
    <iframe
      ref={ref}
      className="fv-frame fv-frame--page"
      style={h ? { height: h } : undefined}
      src={src}
      title={title}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={fit}
    />
  );
}
