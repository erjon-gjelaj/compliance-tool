import type { Metadata } from "next";

/**
 * Everything under /internal is kept out of search entirely.
 *
 * The gate is the real protection — this is defence in depth against the page
 * being indexed if the secret is ever unset or the gate regresses. robots.ts
 * disallows the path too; this is the per-page half of the same instruction,
 * and it is the one that travels with the response.
 */
export const metadata: Metadata = {
  title: "Internal",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
