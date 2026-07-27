/**
 * Types for word-extractor, which ships none.
 *
 * Narrowed to what src/lib/extract.ts actually calls rather than describing
 * the whole library: a declaration that claims more than it has been checked
 * against is worse than a small honest one, because the compiler will believe
 * it. The package also exposes getFootnotes, getHeaders and friends — add
 * them here if something starts using them.
 */
declare module "word-extractor" {
  class Document {
    getBody(): string;
  }

  export default class WordExtractor {
    extract(source: string | Buffer): Promise<Document>;
  }
}
