/**
 * File rules for the document upload step.
 *
 * Pure and dependency-free, because both sides need them: the browser to
 * refuse an obviously wrong file before spending someone's mobile data on
 * it, and the server to decide what it will actually accept. The browser
 * check is a courtesy — every rule here is enforced again server-side, and
 * a third time by the storage bucket's own limits.
 */

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

/**
 * What we take, by extension and by declared type.
 *
 * Documents and photographs only. Photographs are here because a phone
 * camera is how a lot of this paperwork actually exists — a training card
 * photographed on a truck bonnet is a real submission, not a mistake.
 *
 * Everything else is refused, which is what keeps executables and archives
 * out. A .zip is refused even though it is harmless in storage: we would
 * have to open it to know what is inside, and "reject it" is a better answer
 * than "unpack whatever a stranger sent us".
 */
export const ACCEPTED_TYPES = [
  { extension: ".pdf", mime: "application/pdf", label: "PDF" },
  {
    extension: ".docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word document",
  },
  { extension: ".doc", mime: "application/msword", label: "Word document" },
  { extension: ".png", mime: "image/png", label: "Photo or scan" },
  { extension: ".jpg", mime: "image/jpeg", label: "Photo or scan" },
  { extension: ".jpeg", mime: "image/jpeg", label: "Photo or scan" },
  { extension: ".heic", mime: "image/heic", label: "Photo or scan" },
  { extension: ".heif", mime: "image/heif", label: "Photo or scan" },
] as const;

/** The `accept` attribute for the file input. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.map(
  ({ extension }) => extension,
).join(",");

const ALLOWED_MIMES = new Set<string>(
  ACCEPTED_TYPES.map(({ mime }) => mime as string),
);

const ALLOWED_EXTENSIONS = new Set<string>(
  ACCEPTED_TYPES.map(({ extension }) => extension as string),
);

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the browser tells us about a file before it is uploaded. */
export type FileClaim = {
  name: string;
  type: string;
  size: number;
};

export type ClaimCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checks what the browser *claims* about a file.
 *
 * Everything here is self-reported and none of it is trusted as proof — a
 * declared MIME type is a string the caller chose. It is worth checking
 * anyway, because it rejects the honest mistakes (a .zip, a 200MB video)
 * before anything is transferred. What the file actually is gets decided by
 * sniffFileType once the bytes exist.
 */
export function checkClaim(claim: FileClaim): ClaimCheck {
  const extension = extensionOf(claim.name);

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      reason: "that file type isn't one we can read",
    };
  }

  // The declared type is allowed to be empty: some browsers send nothing for
  // .heic, and the extension plus the sniff below cover it.
  if (claim.type && !ALLOWED_MIMES.has(claim.type)) {
    return { ok: false, reason: "that file type isn't one we can read" };
  }

  if (claim.size <= 0) {
    return { ok: false, reason: "that file is empty" };
  }

  if (claim.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `that file is ${formatBytes(claim.size)}, over the ${formatBytes(MAX_FILE_BYTES)} limit`,
    };
  }

  return { ok: true };
}

/**
 * Identifies a file from its leading bytes.
 *
 * This is the check that actually decides what something is. A file called
 * `program.pdf` with a declared type of `application/pdf` can be anything at
 * all; its first four bytes are much harder to argue with.
 *
 * Returns null when the bytes match nothing we accept, which is the answer
 * for an executable, an archive, or a renamed file of any other kind.
 *
 * The .docx case is the interesting one: a .docx *is* a zip, so the magic
 * bytes are `PK\x03\x04` and identical to a plain archive. That is why this
 * takes the declared extension into account for that one format — the
 * combination of "claims to be .docx" and "is a zip" is as far as a
 * magic-byte check can go, and unpacking it to look for word/document.xml is
 * the thing this deliberately does not do with a stranger's upload.
 */
export function sniffFileType(
  bytes: Uint8Array,
  fileName: string,
): string | null {
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  // %PDF
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";

  // \x89PNG
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";

  // JPEG SOI
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";

  // ISO-BMFF box with an 'ftyp' type at offset 4, which is what HEIC is.
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(
      bytes[8],
      bytes[9],
      bytes[10],
      bytes[11],
    );
    if (brand.startsWith("hei") || brand.startsWith("mif")) return "image/heic";
    return null;
  }

  const extension = extensionOf(fileName);

  // Zip container. Only accepted when it claims to be a .docx.
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    return extension === ".docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : null;
  }

  // OLE compound file, which is what a legacy .doc is.
  if (starts(0xd0, 0xcf, 0x11, 0xe0)) {
    return extension === ".doc" ? "application/msword" : null;
  }

  return null;
}

/**
 * A storage object name derived from nothing the uploader controls.
 *
 * The original file name is recorded in the database and never used to build
 * a path: it can contain slashes, `..`, control characters, or 4KB of
 * unicode, and none of that belongs in an object key.
 */
export function storagePathFor(
  submissionId: string,
  index: number,
  extension: string,
): string {
  const unique = globalThis.crypto.randomUUID();
  return `${submissionId}/${index}-${unique}${extension}`;
}
