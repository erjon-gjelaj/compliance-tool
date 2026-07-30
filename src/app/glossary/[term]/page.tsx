import { notFound } from "next/navigation";

import glossary from "../../../../config/glossary.json";
import { pageMetadata } from "@/lib/metadata";

export function generateStaticParams() {
  return glossary.records.map((entry) => ({ term: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term } = await params;
  const entry = glossary.records.find((item) => item.slug === term);
  if (!entry) return {};
  return pageMetadata({
    title: `${entry.term} glossary`,
    description: entry.definition,
    path: `/glossary/${entry.slug}`,
  });
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term } = await params;
  const entry = glossary.records.find((item) => item.slug === term);
  if (!entry) notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="tag">Glossary</p>
      <h1 className="type-h1 mt-3 text-millscale">{entry.term}</h1>
      <p className="type-lede mt-5">{entry.definition}</p>
      <p className="type-body mt-6">
        Platform and hiring-client usage can differ. Confirm the term in your
        own account when it affects a submission.
      </p>
    </main>
  );
}
