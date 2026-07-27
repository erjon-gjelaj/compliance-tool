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
 *  - image OCR via tesseract.js, and only as a fallback
 *
 * The honest-failure part matters as much as the extraction. A photograph of
 * a training card and a scanned PDF with no text layer both extract to
 * nothing, and "nothing" is not the same as "this document is empty". Those
 * come back as `unreadable`, which the response email lists by name — silence
 * about a file nobody could read is exactly the kind of thing that reads as
 * "reviewed and fine".
 */

export type TextStatus =
  | "ok"
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

/* OCR is capped hard. It is seconds per page, it runs inside a serverless
 * invocation with a wall clock, and one 40-page scan should not be able to
 * eat the whole budget and starve every other file in the submission. */
const OCR_MAX_IMAGES = 3;
const OCR_MAX_BYTES = 6 * 1024 * 1024;

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
    // pretend about.
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

/**
 * OCR, as a last resort.
 *
 * Marked `ocr` rather than `ok` on purpose, and the prompt is told what that
 * means: OCR of a photograph taken at an angle in bad light is unreliable,
 * and text this uncertain must not be treated as proof of anything. Wrong
 * text read confidently is worse than admitting the file could not be read.
 */
async function extractByOcr(
  bytes: Uint8Array,
  mimeType: string,
): Promise<Extraction> {
  if (bytes.byteLength > OCR_MAX_BYTES) {
    return {
      status: "unreadable",
      text: "",
      detail: "image too large to read",
    };
  }

  // HEIC has no decoder here, so there is nothing to hand the OCR engine.
  // Saying so plainly beats a confusing empty result.
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    return {
      status: "unreadable",
      text: "",
      detail: "HEIC images can't be read; a JPEG or PDF can be",
    };
  }

  const { createWorker } = await import("tesseract.js");

  // /tmp is the only writable path in a serverless function and survives
  // between invocations on a warm instance, so the ~15MB language data is
  // fetched once per cold start rather than once per file.
  const worker = await createWorker("eng", 1, { cachePath: "/tmp" });

  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    const text = tidy(data.text);

    if (text.length < MIN_MEANINGFUL_CHARS) {
      return {
        status: "unreadable",
        text: "",
        detail: "nothing legible in the image",
      };
    }

    return { status: "ocr", text };
  } finally {
    await worker.terminate();
  }
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
  { allowOcr }: { allowOcr: boolean },
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
        if (!allowOcr) {
          return {
            status: "unreadable",
            text: "",
            detail: "image not read (OCR budget for this submission is spent)",
          };
        }
        return await extractByOcr(input.bytes, input.mimeType);

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

/** How many images this submission may still send to OCR. */
export function ocrBudget(): { spend(): boolean } {
  let used = 0;

  return {
    spend() {
      if (used >= OCR_MAX_IMAGES) return false;
      used += 1;
      return true;
    },
  };
}
