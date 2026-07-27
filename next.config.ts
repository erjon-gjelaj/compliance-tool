import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Kept out of the bundler and required at runtime instead.
   *
   * All three load assets the way a Node library does — pdf.js reaches for
   * its worker and standard fonts, mammoth and word-extractor for their own
   * internals. Bundling them rewrites those paths and they fail at runtime
   * rather than at build time, which is the worst place to find out.
   */
  serverExternalPackages: ["unpdf", "mammoth", "word-extractor"],
};

export default nextConfig;
