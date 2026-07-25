/**
 * The page's signature detail: a tape-measure rule.
 *
 * A hairline with minor ticks every 16px and a taller tick every 80px,
 * the way a steel tape reads. It separates sections and gives the page a
 * measured, shop-drawing feel without any decorative filler.
 *
 * `id` must be unique per instance — SVG pattern ids are document-global.
 */
export function TickRule({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`block h-3 w-full text-zinc-dust ${className ?? ""}`}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          id={id}
          width="80"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0.5" y1="0" x2="0.5" y2="11" stroke="currentColor" />
          <line x1="16.5" y1="0" x2="16.5" y2="5" stroke="currentColor" />
          <line x1="32.5" y1="0" x2="32.5" y2="5" stroke="currentColor" />
          <line x1="48.5" y1="0" x2="48.5" y2="5" stroke="currentColor" />
          <line x1="64.5" y1="0" x2="64.5" y2="5" stroke="currentColor" />
        </pattern>
      </defs>
      <line
        x1="0"
        y1="0.5"
        x2="100%"
        y2="0.5"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect width="100%" height="12" fill={`url(#${id})`} />
    </svg>
  );
}
