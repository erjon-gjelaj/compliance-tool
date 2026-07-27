import "server-only";

/**
 * Turns PDF pages into images an OCR engine can read.
 *
 * Only needed for scans. A PDF with a text layer is read by unpdf and never
 * comes near this — see extractPdf.
 *
 * PDFium here is the pure-WASM build, so this keeps the rule that made unpdf
 * the choice in the first place: no native binary, because that is what rules
 * most PDF tooling out on Vercel.
 *
 * Three things happen to each page before the engine sees it, and they matter
 * more to the result than the choice of engine does:
 *
 *  - It is rendered at 300 DPI rather than the 72 DPI a PDF point implies.
 *    Most complaints about Tesseract are really complaints about feeding it a
 *    96 DPI image; resolution is the single biggest lever in the pipeline.
 *  - It is flattened to greyscale and then thresholded to pure black and
 *    white, with the cut chosen by Otsu's method rather than a fixed guess, so
 *    a grey photocopy and a clean scan both come out as crisp glyphs.
 *  - It is handed over as BMP with its resolution recorded in the header, so
 *    the engine knows the true DPI instead of estimating it.
 *
 * Not done: deskew. A page scanned at an angle stays at an angle. It is a
 * real gap for photographed pages and much less of one for scanner output,
 * and it wants proper testing against real documents rather than a guess.
 */

/**
 * Exported so the OCR engine can be told the true figure rather than left to
 * infer it. 72pt to the inch, hence the scale factor PDFium needs.
 */
export const RASTER_DPI = 300;
const SCALE = RASTER_DPI / 72;

/** Guards against a poster-sized page turning into a gigabyte of bitmap. */
const MAX_PIXELS = 40_000_000;

export type RasterPage = {
  pageNumber: number;
  /** 8-bit greyscale BMP, ready for an OCR engine. */
  bmp: Buffer;
};

/**
 * Otsu's method: the threshold that best separates the histogram into two
 * groups. Beats a fixed 128 on exactly the documents that matter here —
 * faded photocopies, and scans with the lid left open.
 */
function otsuThreshold(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = -1;

  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) ** 2;

    if (between > bestVariance) {
      bestVariance = between;
      best = t;
    }
  }

  return best;
}

/** BGRA from PDFium to a thresholded 8-bit greyscale plane. */
function toBilevel(bgra: Uint8Array, width: number, height: number): Uint8Array {
  const pixels = width * height;
  const grey = new Uint8Array(pixels);
  const histogram = new Uint32Array(256);

  for (let i = 0; i < pixels; i += 1) {
    const at = i * 4;
    // Rec. 601 luma. Integer maths on purpose — this runs tens of millions of
    // times per page and the fractional accuracy buys nothing downstream.
    const value =
      (bgra[at + 2] * 299 + bgra[at + 1] * 587 + bgra[at] * 114) / 1000;
    const level = value > 255 ? 255 : value | 0;
    grey[i] = level;
    histogram[level] += 1;
  }

  const threshold = otsuThreshold(histogram, pixels);
  for (let i = 0; i < pixels; i += 1) grey[i] = grey[i] > threshold ? 255 : 0;

  return grey;
}

/**
 * Wraps a greyscale plane as an 8-bit BMP.
 *
 * BMP rather than PNG because encoding is a header and a memcpy: a pure-JS
 * PNG encoder would spend seconds per page compressing an image that is about
 * to be thrown away, and those seconds come out of the OCR budget. Leptonica,
 * underneath Tesseract, reads BMP directly.
 */
function encodeBmp(grey: Uint8Array, width: number, height: number): Buffer {
  const rowStride = (width + 3) & ~3; // rows pad to a 4-byte boundary
  const pixelBytes = rowStride * height;
  const offset = 14 + 40 + 256 * 4; // headers + greyscale palette
  const buffer = Buffer.alloc(offset + pixelBytes);

  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(offset, 10);

  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22); // positive: rows run bottom-up
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(8, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelBytes, 34);

  // Resolution in pixels per metre. This is the field that stops Tesseract
  // guessing the DPI, which it otherwise does out loud and often wrongly.
  const perMetre = Math.round(RASTER_DPI * 39.3701);
  buffer.writeInt32LE(perMetre, 38);
  buffer.writeInt32LE(perMetre, 42);
  buffer.writeUInt32LE(256, 46);
  buffer.writeUInt32LE(256, 50);

  for (let i = 0; i < 256; i += 1) {
    const at = 54 + i * 4;
    buffer[at] = i;
    buffer[at + 1] = i;
    buffer[at + 2] = i;
  }

  for (let y = 0; y < height; y += 1) {
    // BMP stores the bottom row first.
    const source = (height - 1 - y) * width;
    buffer.set(grey.subarray(source, source + width), offset + y * rowStride);
  }

  return buffer;
}

export type RasteriseResult = {
  /** Pages actually handed to the callback. */
  rendered: number;
  /** Pages in the document, whether or not they were rendered. */
  totalPages: number;
};

/**
 * Renders up to `maxPages` pages, newest work first, stopping early when
 * `deadline` passes.
 *
 * Two limits rather than one, because they fail differently: the page cap
 * bounds a predictable job, and the clock catches the page that turns out to
 * be a full-bleed photograph. Whatever comes back reports how many pages it
 * actually covers, and the caller is expected to say so out loud rather than
 * let a partial read look like a whole one.
 */
export async function rasterisePdf(
  bytes: Uint8Array,
  { maxPages, deadline }: { maxPages: number; deadline: number },
  onPage: (page: RasterPage) => Promise<void>,
): Promise<RasteriseResult> {
  const { PDFiumLibrary } = await import("@hyzyla/pdfium");

  const library = await PDFiumLibrary.init();
  let document: Awaited<ReturnType<typeof library.loadDocument>> | null = null;

  try {
    document = await library.loadDocument(Buffer.from(bytes));
    const totalPages = document.getPageCount();
    const limit = Math.min(totalPages, maxPages);
    let rendered = 0;

    for (let index = 0; index < limit; index += 1) {
      if (Date.now() > deadline) break;

      const page = document.getPage(index);
      const bitmap = await page.render({ scale: SCALE, render: "bitmap" });

      if (bitmap.width * bitmap.height > MAX_PIXELS) continue;

      const grey = toBilevel(bitmap.data, bitmap.width, bitmap.height);

      // Handed over one page at a time rather than collected into an array.
      // A 300 DPI letter page is ~8MB as a bitmap, so a ten-page cap would
      // otherwise hold 80MB for no reason, and the deadline would only be
      // checked after every page had already been rendered.
      await onPage({
        pageNumber: index + 1,
        bmp: encodeBmp(grey, bitmap.width, bitmap.height),
      });

      rendered += 1;
    }

    return { rendered, totalPages };
  } finally {
    document?.destroy();
    library.destroy();
  }
}
