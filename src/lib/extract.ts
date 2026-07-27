import "server-only";

import { RASTER_DPI, rasterisePdf } from "@/lib/rasterise";

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
  /**
   * Shown to the person who uploaded it, unlike `detail`.
   *
   * Set when the file was read but not all of it — a scan we stopped part way
   * through. A partial read that looks like a whole one is the failure mode
   * this exists to prevent: someone whose 80-page manual was read as far as
   * page 10 must be told which pages the answer covers.
   */
  notice?: string;
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

/*
 * Scanned PDFs get their own budget, in pages and in seconds.
 *
 * Six pages is a judgement about what a prequalification file looks like:
 * the front matter, contents and opening sections of a safety manual are
 * where the subjects we search for are named. It is not a claim to have read
 * the document, and the email says which pages the answer covers.
 *
 * The clock exists because the page cap alone does not bound the work — a
 * full-bleed scan takes far longer than a page of text.
 *
 * Both numbers are sized for the 60s ceiling of Vercel's Hobby plan, which is
 * what maxDuration on the route is set to. 22s of OCR leaves the analysis,
 * the email and a cold start room to finish inside it — the first production
 * attempt used 38s and the invocation died before the email went out, which
 * is the worst outcome available: the contractor hears nothing at all. On a
 * plan allowing a longer maxDuration, raise that first and these after.
 */
const PDF_OCR_MAX_PAGES = 6;
const PDF_OCR_BUDGET_MS = 22_000;

/**
 * A single OCR call may not exceed this, whatever it thinks it is doing.
 *
 * Not belt and braces on top of the budget — a different failure. The budget
 * assumes work finishes and asks whether there is time for more. This assumes
 * nothing: tesseract.js runs OCR in a child process, and a child that dies
 * badly leaves a promise that never settles either way, which no deadline
 * check placed between pages can ever reach.
 *
 * That is not hypothetical. On Vercel the worker fails to boot at all —
 * `Cannot find module '..'`, its own package root, unresolvable under the
 * platform's module loader — and the first production scan hung until the
 * function was killed at 60 seconds, taking the email with it.
 */
const OCR_CALL_TIMEOUT_MS = 12_000;

/**
 * Bounds a promise that may never settle.
 *
 * Returns null rather than throwing, because every caller's answer to "OCR
 * did not happen" is the same: treat the file as unread and carry on. The
 * timer is unref'd so a stray one cannot hold the process open.
 */
async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  label: string,
): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;

  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.error(`${label} exceeded ${ms}ms and was abandoned`);
      resolve(null);
    }, ms);
    timer.unref?.();
  });

  try {
    return await Promise.race([work, expiry]);
  } catch (cause) {
    // A rejection here is the same outcome as a timeout: no text.
    console.error(`${label} failed:`, cause);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/*
 * The accurate LSTM models rather than the speed-tuned ones tesseract.js
 * pulls by default. Slower per page and measurably better on the photocopied,
 * slightly-askew pages this is aimed at.
 */
const TESSDATA_BEST = "https://tessdata.projectnaptha.com/4.0.0_best";

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

async function extractPdf(
  bytes: Uint8Array,
  budget: OcrBudget,
): Promise<Extraction> {
  const { extractText, getDocumentProxy } = await import("unpdf");

  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = tidy(Array.isArray(text) ? text.join("\n\n") : text);

  if (merged.length < MIN_MEANINGFUL_CHARS) {
    // A PDF that is a photograph of paper. Render the pages and read those
    // instead — this is the commonest shape a contractor's safety manual
    // arrives in, and giving up on it was giving up on most of them.
    //
    // The budget is claimed here rather than by the caller, which cannot know
    // whether a PDF is a scan without opening it. A text-layer PDF costs
    // nothing and leaves the whole allowance for the file that needs it.
    if (!budget.spend()) {
      return {
        status: "unreadable",
        text: "",
        detail: "scanned PDF not read (OCR budget for this submission is spent)",
      };
    }

    return await extractScannedPdf(bytes, budget.deadline);
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
 * A configured Tesseract worker.
 *
 * /tmp is the only writable path in a serverless function and survives
 * between invocations on a warm instance, so the language data is fetched
 * once per cold start rather than once per file.
 *
 * Page segmentation is set to AUTO explicitly rather than left to the
 * default. These are whole scanned pages with headings, columns and tables,
 * so the layout analysis is wanted; the default treats the image as one
 * uniform block, which runs headings and body text together.
 */
async function ocrWorker() {
  const { createWorker, PSM } = await import("tesseract.js");

  // Bounded, because this is where it fails on Vercel: the worker is a child
  // process, and a child that cannot resolve its own entry point never
  // reports back. Null here means OCR is unavailable, which every caller
  // handles as "the file could not be read" rather than as a crash.
  const worker = await withTimeout(
    createWorker("eng", 1, { cachePath: "/tmp", langPath: TESSDATA_BEST }),
    OCR_CALL_TIMEOUT_MS,
    "OCR worker startup",
  );

  if (!worker) return null;

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    // Stated rather than left to be inferred. Tesseract estimates the
    // resolution from glyph size when it cannot read one, and got 422 for a
    // 300 DPI render in testing — close enough not to fail, wrong enough to
    // skew its own layout heuristics. The BMP header carries the real figure
    // but Leptonica does not surface it, so it is set here too.
    user_defined_dpi: String(RASTER_DPI),
  });

  return worker;
}

/**
 * A scanned PDF: no text layer, so render the pages and read the pictures.
 *
 * Comes back as `ocr`, never `ok`, which is what stops it being treated as
 * proof of absence downstream — see isReliable. That matters doubly here,
 * because this may have read ten pages of eighty: a phrase we did not find
 * could be on page 47, so "we did not see it" cannot become "you do not have
 * it" no matter how good the recognition was.
 */
async function extractScannedPdf(
  bytes: Uint8Array,
  deadline: number,
): Promise<Extraction> {
  const worker = await ocrWorker();

  if (!worker) {
    return {
      status: "unreadable",
      text: "",
      detail: "no text layer, and OCR is unavailable in this environment",
    };
  }

  const parts: string[] = [];
  let read = 0;
  let totalPages = 0;

  try {
    // Rendered and read one page at a time rather than rendering all ten
    // first: peak memory stays at a single ~8MB page, and the clock gets
    // consulted between every page instead of only after all the rendering.
    ({ totalPages } = await rasterisePdf(
      bytes,
      { maxPages: PDF_OCR_MAX_PAGES, deadline },
      async (page) => {
        if (Date.now() > deadline) return;

        const result = await withTimeout(
          worker.recognize(page.bmp),
          OCR_CALL_TIMEOUT_MS,
          `OCR of page ${page.pageNumber}`,
        );

        // A page that timed out or threw is not counted as read, so the page
        // total reported to the contractor stays honest.
        if (!result) return;

        const text = tidy(result.data.text);
        read += 1;
        if (text) parts.push(text);
      },
    ));
  } finally {
    await worker.terminate();
  }

  if (read === 0) {
    return {
      status: "unreadable",
      text: "",
      detail: "no text layer, and no page could be read",
    };
  }

  const merged = tidy(parts.join("\n\n"));

  if (merged.length < MIN_MEANINGFUL_CHARS) {
    return {
      status: "unreadable",
      text: "",
      detail: `no text layer; OCR of ${read} rendered page(s) found nothing legible`,
    };
  }

  return {
    status: "ocr",
    text: merged,
    detail: `scanned PDF, OCR of ${read}/${totalPages} pages`,
    // Only when it is actually partial. Saying "we read all 3 of 3 pages"
    // invites doubt about a complete read.
    notice:
      read < totalPages
        ? `This is a scan with no text in it, so we read it by image recognition — and only the first ${read} ${read === 1 ? "page" : "pages"} of ${totalPages}. Anything after that was not looked at.`
        : undefined,
  };
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

  const worker = await ocrWorker();

  if (!worker) {
    return {
      status: "unreadable",
      text: "",
      detail: "OCR is unavailable in this environment",
    };
  }

  try {
    const result = await withTimeout(
      worker.recognize(Buffer.from(bytes)),
      OCR_CALL_TIMEOUT_MS,
      "OCR of image",
    );

    if (!result) {
      return { status: "unreadable", text: "", detail: "OCR did not complete" };
    }

    const text = tidy(result.data.text);

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
  { budget }: { budget: OcrBudget },
): Promise<Extraction> {
  try {
    switch (input.mimeType) {
      case "application/pdf":
        return await extractPdf(input.bytes, budget);

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await extractDocx(input.bytes);

      case "application/msword":
        return await extractDoc(input.bytes);

      case "image/png":
      case "image/jpeg":
      case "image/heic":
      case "image/heif":
        if (!budget.spend()) {
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

export type OcrBudget = {
  /** Claims a slot. False once this submission has had its share. */
  spend(): boolean;
  /** Wall-clock stop for ALL OCR in this submission, not per file. */
  deadline: number;
};

/**
 * What one submission may spend on OCR, in files and in seconds.
 *
 * The deadline is shared deliberately. Per-file budgets multiply: four
 * scanned PDFs at 38 seconds each is well past any serverless limit, and the
 * failure would be the whole invocation dying — losing the email as well as
 * the analysis — rather than one file coming back unread.
 */
export function ocrBudget(): OcrBudget {
  let used = 0;
  const deadline = Date.now() + PDF_OCR_BUDGET_MS;

  return {
    spend() {
      if (used >= OCR_MAX_IMAGES) return false;
      used += 1;
      return true;
    },
    deadline,
  };
}
