import { TickRule } from "@/components/tick-rule";

/**
 * Standard opening block for the interior pages, so About, FAQ and Contact
 * all start on the same rhythm as the home page hero: mono tag, page title,
 * lede, then a crop of the tape rule.
 *
 * `tickId` must be unique per page — SVG pattern ids are document-global.
 */
export function PageIntro({
  tag,
  title,
  tickId,
  children,
}: {
  tag: string;
  title: string;
  tickId: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-zinc-dust">
      <div className="mx-auto max-w-5xl px-6 pt-14 pb-12 md:pt-20 md:pb-16">
        <p className="tag">{tag}</p>
        <h1 className="type-h1 mt-5 max-w-3xl">{title}</h1>
        {children ? (
          <div className="type-lede mt-6 max-w-2xl space-y-4">{children}</div>
        ) : null}
        <TickRule id={tickId} className="mt-10 max-w-[18rem]" />
      </div>
    </section>
  );
}

/** A titled band of body copy, matching the home page section rhythm. */
export function PageSection({
  heading,
  headingId,
  children,
  className,
}: {
  heading: string;
  headingId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={`border-b border-zinc-dust ${className ?? ""}`}
    >
      <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
        <h2 id={headingId} className="type-h2 max-w-2xl">
          {heading}
        </h2>
        <div className="mt-6 max-w-2xl space-y-4">{children}</div>
      </div>
    </section>
  );
}
