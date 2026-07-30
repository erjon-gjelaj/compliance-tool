import Link from "next/link";
import { notFound } from "next/navigation";

import { PROGRAM_CATALOG } from "@/lib/config";
import { pageMetadata } from "@/lib/metadata";

const PLATFORM_KEYS = new Set([
  "isnetworld",
  "avetta",
  "veriforce",
  "complyworks",
  "browz",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trade: string; platform: string }>;
}) {
  const { trade, platform } = await params;
  return pageMetadata({
    title: `${trade.replaceAll("-", " ")} ${platform} requirements`,
    description:
      "Explore the configured programs commonly used to build a contractor prequalification file.",
    path: `/requirements/${trade}/${platform}`,
  });
}

export default async function RequirementExplorerPage({
  params,
}: {
  params: Promise<{ trade: string; platform: string }>;
}) {
  const { trade, platform } = await params;
  if (!PLATFORM_KEYS.has(platform)) notFound();

  const always = PROGRAM_CATALOG.filter(
    (program) => program.triggered_by.op === "always",
  );
  const conditional = PROGRAM_CATALOG.filter(
    (program) => program.triggered_by.op !== "always",
  );
  const title = trade.replaceAll("-", " ");

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="tag">Requirement explorer</p>
      <h1 className="type-h1 mt-3 capitalize text-millscale">
        {title} on {platform}
      </h1>
      <p className="type-lede mt-5 max-w-3xl">
        This is a working list generated from CertLoop&rsquo;s unverified
        reference config. Your hiring client&rsquo;s portal is the list that
        decides your file.
      </p>

      <section className="mt-10">
        <h2 className="type-h2 text-millscale">Programs triggered for all work</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {always.map((program) => (
            <li key={program.program_key} className="border border-zinc-dust bg-paper p-4">
              <p className="font-medium text-millscale">{program.title}</p>
              <p className="mt-1 text-sm text-slate-wash">
                Tier {program.tier}; verify against the live account.
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="type-h2 text-millscale">Scope-dependent programs</h2>
        <p className="type-body mt-3">
          These depend on work methods or company facts. CertLoop will not
          guess which apply.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {conditional.map((program) => (
            <li key={program.program_key} className="border border-zinc-dust bg-paper p-4">
              <p className="font-medium text-millscale">{program.title}</p>
              <p className="mt-1 text-sm text-slate-wash">
                {program.triggered_by.op === "unknown"
                  ? program.triggered_by.reason
                  : "Requires a matching company or scope fact."}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/gap-check" className="btn-primary mt-10 inline-flex">
        Check your own file
      </Link>
    </main>
  );
}
