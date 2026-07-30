import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Kept out of the bundler and required at runtime instead.
   *
   * All four load assets the way a Node library does — pdf.js reaches for its
   * worker and standard fonts, pdfkit for the AFM metrics of the base-14
   * fonts, mammoth and word-extractor for their own internals. Bundling them
   * rewrites those paths and they fail at runtime rather than at build time,
   * which is the worst place to find out.
   *
   * pdfkit was the one that proved it. Left in the bundle, it resolved its
   * font data against the bundler's virtual project root and asked the
   * filesystem for `/ROOT/node_modules/pdfkit/js/data/Helvetica.afm` — a path
   * that exists on no machine. Tracing was never the problem: the .afm files
   * were in the deployment all along, under their real path, which is why
   * `outputFileTracingIncludes` would have changed nothing.
   */
  serverExternalPackages: [
    "@napi-rs/canvas",
    "@tesseract.js-data/eng",
    "unpdf",
    "pdfkit",
    "mammoth",
    "sharp",
    "tesseract.js",
    "word-extractor",
  ],
};

export default nextConfig;
