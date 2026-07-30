import "server-only";

export type TextStatus =
  | "ok"
  | "ocr"
  | "needs_review"
  | "unreadable"
  | "unsupported"
  | "error";

export type ExtractionMethod = "text" | "ocr" | "mixed" | "manual";

export type PageExtraction = {
  page: number;
  text: string;
  method: "text" | "ocr";
  confidence: number;
  reviewRequired: boolean;
};

export type Extraction = {
  status: TextStatus;
  method: ExtractionMethod | null;
  confidence: number | null;
  text: string;
  pages: number;
  pageMap: PageExtraction[];
  detail?: string;
};

const MAX_TEXT_CHARS = 240_000;
const MIN_MEANINGFUL_CHARS = 40;
const OCR_REVIEW_THRESHOLD = 0.72;

function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function combinedText(pageMap: PageExtraction[]): string {
  const text = pageMap
    .map((page) => page.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return text.length > MAX_TEXT_CHARS
    ? `${text.slice(0, MAX_TEXT_CHARS)}\n\n[truncated]`
    : text;
}

async function recognizeImage(
  bytes: Uint8Array,
  page: number,
): Promise<PageExtraction> {
  const [{ createWorker, OEM }, language] = await Promise.all([
    import("tesseract.js"),
    import("@tesseract.js-data/eng"),
  ]);
  const worker = await createWorker(language.default.code, OEM.LSTM_ONLY, {
    langPath: language.default.langPath,
    gzip: language.default.gzip,
  });

  try {
    const result = await worker.recognize(Buffer.from(bytes));
    const confidence = Math.max(0, Math.min(1, result.data.confidence / 100));
    return {
      page,
      text: tidy(result.data.text),
      method: "ocr",
      confidence,
      reviewRequired: confidence < OCR_REVIEW_THRESHOLD,
    };
  } finally {
    await worker.terminate();
  }
}

function finish(pageMap: PageExtraction[]): Extraction {
  const text = combinedText(pageMap);
  const ocrPages = pageMap.filter((page) => page.method === "ocr");
  const reviewRequired = pageMap.some((page) => page.reviewRequired);
  const method: ExtractionMethod =
    ocrPages.length === 0
      ? "text"
      : ocrPages.length === pageMap.length
        ? "ocr"
        : "mixed";
  const confidence =
    pageMap.length === 0
      ? null
      : pageMap.reduce((sum, page) => sum + page.confidence, 0) /
        pageMap.length;

  if (!text) {
    return {
      status: "unreadable",
      method,
      confidence,
      text: "",
      pages: pageMap.length,
      pageMap,
      detail: "no usable text recovered",
    };
  }

  return {
    status: reviewRequired ? "needs_review" : ocrPages.length > 0 ? "ocr" : "ok",
    method,
    confidence,
    text,
    pages: pageMap.length,
    pageMap,
  };
}

async function extractPdf(bytes: Uint8Array): Promise<Extraction> {
  const {
    definePDFJSModule,
    extractText,
    getDocumentProxy,
    renderPageAsImage,
  } = await import("unpdf");

  await definePDFJSModule(() => import("pdfjs-dist"));
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: false });
  const rawPages = Array.isArray(extracted.text)
    ? extracted.text
    : [extracted.text];
  const pageMap: PageExtraction[] = [];

  for (let index = 0; index < pdf.numPages; index += 1) {
    const text = tidy(rawPages[index] ?? "");
    if (text.length >= MIN_MEANINGFUL_CHARS) {
      pageMap.push({
        page: index + 1,
        text,
        method: "text",
        confidence: 1,
        reviewRequired: false,
      });
      continue;
    }

    const rendered = await renderPageAsImage(pdf, index + 1, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 2,
    });
    if (typeof rendered === "string") {
      throw new Error("PDF renderer returned a data URL instead of bytes");
    }
    pageMap.push(await recognizeImage(new Uint8Array(rendered), index + 1));
  }

  return finish(pageMap);
}

async function extractDocx(bytes: Uint8Array): Promise<Extraction> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });
  return finish([
    {
      page: 1,
      text: tidy(value),
      method: "text",
      confidence: 1,
      reviewRequired: false,
    },
  ]);
}

async function extractDoc(bytes: Uint8Array): Promise<Extraction> {
  const WordExtractor = (await import("word-extractor")).default;
  const document = await new WordExtractor().extract(Buffer.from(bytes));
  return finish([
    {
      page: 1,
      text: tidy(document.getBody()),
      method: "text",
      confidence: 1,
      reviewRequired: false,
    },
  ]);
}

export type ExtractionInput = {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

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
        return finish([await recognizeImage(input.bytes, 1)]);
      default:
        return {
          status: "unsupported",
          method: null,
          confidence: null,
          text: "",
          pages: 0,
          pageMap: [],
          detail: `no extractor for ${input.mimeType}`,
        };
    }
  } catch (cause) {
    console.error(`Extraction failed for ${input.fileName}:`, cause);
    return {
      status: "error",
      method: null,
      confidence: null,
      text: "",
      pages: 0,
      pageMap: [],
      detail: cause instanceof Error ? cause.message : "unknown error",
    };
  }
}
