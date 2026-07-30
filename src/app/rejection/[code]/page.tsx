import { notFound } from "next/navigation";

import { REJECTION_CODES } from "@/lib/config";
import { pageMetadata } from "@/lib/metadata";

export function generateStaticParams() {
  return REJECTION_CODES.map((entry) => ({ code: entry.public_slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const entry = REJECTION_CODES.find((item) => item.public_slug === code);
  if (!entry) return {};
  return pageMetadata({
    title: `${entry.code}: ${entry.cause}`,
    description: `What this rejection wording may mean and the configured fix path: ${entry.fix_path}.`,
    path: `/rejection/${entry.public_slug}`,
  });
}

export default async function RejectionReasonPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const entry = REJECTION_CODES.find((item) => item.public_slug === code);
  if (!entry) notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="tag">{entry.code}</p>
      <h1 className="type-h1 mt-3 text-millscale">{entry.cause}</h1>
      <p className="type-lede mt-5">
        Configured fix path: {entry.fix_path}.
      </p>
      <p className="type-body mt-6">
        Reviewer wording varies. Paste the exact feedback and check the
        document they reviewed; ambiguous feedback remains unclassified.
      </p>
    </main>
  );
}
