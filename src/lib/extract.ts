import "server-only";

/**
 * Pulls text out of an uploaded document.
 *
 * Deliberately not a model call. Extraction is a mechanical job with a right
 * answer, and a language model does it slower, non-deterministically, at a
 * cost per page, and with the ability to invent text that isn't in the file —
 * which is the one failure this project can least afford. Libraries do it
 * exactly or fail honestly.
 *
 *  - PDF   unpdf, a serverless-targeted build of Mozilla's pdf.js. No native
 *          binary, which is what rules most PDF tooling out on Vercel.
 *  - DOCX  mammoth
 *  - DOC   word-extractor, for the old OLE binary format
 *
 * The honest-failure part matters as much as the extraction. A photograph of
 * a training card and a scanned PDF with no text layer both extract to
 * nothing, and "nothing" is not the same as "this document is empty". Those
 * come back as `unreadable`, which the response email lists by name — silence
 * about a file nobody could read is exactly the kind of thing that reads as
 * "reviewed and fine".
 *
 * ## No OCR, for now
 *
 * There was OCR here. It never once worked in production: tesseract.js runs
 * in a child process, and Vercel's module loader cannot resolve that worker's
 * own package root, so it died on every invocation — and because the analysis
 * runs inside after(), the first real scan took the email down with it.
 *
 * The replacements all cost something ongoing: a hosted OCR API, or a Pro
 * plan for the wall clock, or a second deployable to run an engine on. None
 * of them is worth buying before we know how many contractors actually have
 * nothing but a scan, and that number is currently a guess. So scans are
 * accepted, recorded, reported as unread with advice on what to send instead,
 * and left for a person to open — which at this volume is both more accurate
 * than OCR and already possible from /internal/submissions.
 *
 * What would justify bringing it back: a run of real submissions where the
 * only document is a scan. The evidence is being collected by doing nothing.
 */

export type TextStatus =
  | "ok"
  /**
   * Text recovered by image recognition. Nothing produces this today — see
   * "No OCR, for now" above — but the status and the rules that depend on it
   * are kept, because they are what make OCR safe to reintroduce. See
   * isReliable in analysis/documents.ts.
   */
  | "ocr"
  | "unreadable"
  | "unsupported"
  | "error";

export type Extraction = {
  status: TextStatus;
  text: string;
  /** Recorded for the log; never shown to the person who uploaded the file. */
  detail?: string;
};

/** Beyond this, the text is truncated — a 200-page manual is not worth the tokens. */
const MAX_TEXT_CHARS = 60_000;

/**
 * A page's worth of text. Below this a PDF is treated as having no real text
 * layer: scanners often emit a few stray characters, and a handful of
 * punctuation marks is not something to analyse.
 */
const MIN_MEANINGFUL_CHARS = 40;

function tidy(raw: string): string {
  const text = raw
    .replace(/\r\n?/g, "\n")
    // Runs of blank lines carry no information and cost tokens.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return text.length > MAX_TEXT_CHARS
    ? `${text.slice(0, MAX_TEXT_CHARS)}\n\n[truncated]`
    : text;
}

async function extractPdf(bytes: Uint8Array): Promise<Extraction> {
  const { extractText, getDocumentProxy } = await import("unpdf");

  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = tidy(Array.isArray(text) ? text.join("\n\n") : text);

  if (merged.length < MIN_MEANINGFUL_CHARS) {
    // A PDF that is a photograph of paper. Nothing to read, and nothing to
    // pretend about — the email names the file and says what to send instead.
    return {
      status: "unreadable",
      text: "",
      detail: "no text layer (likely a scan)",
    };
  }

  return { status: "ok", text: merged };
}

async function extractDocx(bytes: Uint8Array): Promise<Extraction> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });
  const text = tidy(value);

  if (!text) {
    return { status: "unreadable", text: "", detail: "document had no text" };
  }

  return { status: "ok", text };
}

async function extractDoc(bytes: Uint8Array): Promise<Extraction> {
  const WordExtractor = (await import("word-extractor")).default;
  const document = await new WordExtractor().extract(Buffer.from(bytes));
  const text = tidy(document.getBody());

  if (!text) {
    return { status: "unreadable", text: "", detail: "document had no text" };
  }

  return { status: "ok", text };
}

export type ExtractionInput = {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

/**
 * Extracts one document. Never throws — a file that blows up is recorded as
 * an error and reported as unassessed, rather than taking the whole
 * submission down with it.
 */
export async function extractDocument(
  input: ExtractionInput,
): Promise<Extraction> {
  try {
    switch (input.mimeType) {
      case "application/pdf":
        return await extractPdf(input.bytes);

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await extractDocx(input.bytes);

      case "application/msword":
        return await extractDoc(input.bytes);

      case "image/png":
      case "image/jpeg":
      case "image/heic":
      case "image/heif":
        // Still accepted at upload, still stored, still listed for a person to
        // open. There is simply no text in a photograph to search.
        return {
          status: "unreadable",
          text: "",
          detail: "image: no text to search without OCR",
        };

      default:
        return {
          status: "unsupported",
          text: "",
          detail: `no extractor for ${input.mimeType}`,
        };
    }
  } catch (cause) {
    console.error(`Extraction failed for ${input.fileName}:`, cause);
    return {
      status: "error",
      text: "",
      detail: cause instanceof Error ? cause.message : "unknown error",
    };
  }
}
