import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { GAP_CHECK_HREF } from "@/lib/nav";

const REASSURANCE = [
  "About a minute to start",
  "No account or card",
  "Attach documents when you are ready",
] as const;

export function HomeCta() {
  return (
    <section className="border-b border-zinc-dust">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:py-20">
        <div>
          <p className="tag">Ready when you are</p>
          <h2 className="type-h2 mt-4 max-w-2xl">
            Get a clear starting point for your company file
          </h2>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {REASSURANCE.map((item) => (
              <li
                key={item}
                className="inline-flex items-center gap-2 text-sm text-slate-wash"
              >
                <Check
                  aria-hidden
                  strokeWidth={2}
                  className="h-4 w-4 text-verdigris"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Link href={GAP_CHECK_HREF} className="btn-primary">
          Start your free gap check
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
