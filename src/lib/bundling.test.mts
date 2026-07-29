import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { NextConfig } from "next";

import rawConfig from "../../next.config.ts";

/*
 * tsx transpiles next.config.ts to CJS, and the ESM interop then presents the
 * result as `{ default: { default: config } }` — the default export wrapped
 * twice. Unwrapping defensively rather than reaching straight for
 * `.default.default`, so this keeps working if that interop changes; the
 * failure it would otherwise produce is a passing-looking config of
 * `undefined` falling through to `?? []`, which is how the first draft of
 * this test managed to fail against a config that was already correct.
 */
const nextConfig = ((rawConfig as { default?: NextConfig }).default ??
  rawConfig) as NextConfig;

/**
 * The packages that must not be bundled.
 *
 * This file exists because the rest of the suite cannot catch this class of
 * bug and proved it: `render-output.test.mts` renders a real PDF and asserts
 * it starts with `%PDF-`, and it passed on every run while document
 * generation was failing in production for every customer. Tests run in Node,
 * where `require("pdfkit")` resolves normally and reads its font metrics from
 * the real package directory. The deployment ran bundled code, where the same
 * read resolved against the bundler's virtual root and asked for
 * `/ROOT/node_modules/pdfkit/js/data/Helvetica.afm`.
 *
 * Nothing about the rendering code was wrong, so no test of the rendering
 * code could have found it. The fault was one entry missing from a config
 * array, which is exactly the kind of thing that gets tidied away by someone
 * who sees a list of strings and no reason for it.
 *
 * Each package here loads a file from its own directory at runtime — font
 * metrics, a pdf.js worker, internal data — by a path computed from where it
 * thinks it lives. Bundling rewrites that path to somewhere that does not
 * exist, and because the read happens on first use rather than on import, it
 * fails in production and nowhere else.
 */
const MUST_BE_EXTERNAL = [
  // Reads .afm metrics for the base-14 fonts. This is the one that shipped
  // broken; see the note in lib/programs/render-pdf.ts.
  "pdfkit",
  // pdf.js: reaches for its worker and its own standard fonts.
  "unpdf",
  "mammoth",
  "word-extractor",
];

test("every package that reads its own files at runtime stays out of the bundle", () => {
  const external = nextConfig.serverExternalPackages ?? [];

  for (const name of MUST_BE_EXTERNAL) {
    assert.ok(
      external.includes(name),
      `${name} must be in serverExternalPackages. Bundled, it will look for ` +
        `its own data files under a path that does not exist at runtime, and ` +
        `it will do that only in production — the test suite runs in Node, ` +
        `where the same code works.`,
    );
  }
});
