/**
 * The one spinner on the site.
 *
 * A bordered square with one edge coloured and the rest transparent, spun by
 * `animate-spin`. No SVG and no library: it is four border declarations, it
 * inherits `currentColor` so it works on the verdigris button and on a plain
 * text link without a variant for each, and there is nothing to load.
 *
 * `motion-reduce:animate-none` is not decoration. A continuously spinning
 * element is one of the things prefers-reduced-motion exists for, and it can
 * genuinely provoke symptoms in people with vestibular disorders. Stopped, it
 * still reads as a marker beside "Sending…" — the text is what carries the
 * meaning either way, which is also why this is aria-hidden: the accessible
 * announcement comes from the button's own label changing, and a spinner
 * announcing itself as well would say the same thing twice.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none ${className}`}
    />
  );
}
