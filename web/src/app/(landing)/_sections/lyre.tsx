// The Orphic mark: a single-line lyre. On hover its four strings are plucked (see .lyre-* in hero.css).
export function Lyre({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lyre ${className}`}
      aria-hidden="true"
    >
      {/* arms: rise from the sound box and curl outward at the top */}
      <path d="M10.5 24 C 6.2 19.5 5.6 12.5 8.6 7.6 C 9.6 6 11.4 6.2 11.3 8" />
      <path d="M21.5 24 C 25.8 19.5 26.4 12.5 23.4 7.6 C 22.4 6 20.6 6.2 20.7 8" />
      {/* yoke */}
      <path d="M7.4 10.5 H 24.6" />
      {/* sound box */}
      <path d="M9.6 23.4 Q 9.6 28.2 16 28.2 Q 22.4 28.2 22.4 23.4 Z" fill="currentColor" stroke="none" />
      {/* strings */}
      <g className="lyre-strings" strokeWidth="1.1">
        <path className="lyre-s lyre-s1" d="M13 10.5 V 23.6" />
        <path className="lyre-s lyre-s2" d="M15 10.5 V 23.6" />
        <path className="lyre-s lyre-s3" d="M17 10.5 V 23.6" />
        <path className="lyre-s lyre-s4" d="M19 10.5 V 23.6" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`group inline-flex items-center gap-2.5 ${className}`}>
      <Lyre size={26} className="text-[var(--pom)]" />
      <span className="lp-display text-[25px] leading-none tracking-[-0.01em] text-[var(--bone)]">orphic</span>
    </span>
  );
}
