import type { StoredDocument } from "@/lib/documents";
import type { TextStatus } from "@/lib/extract";

/**
 * An uploaded document plus whatever came out of it.
 *
 * `status` is the field to read before `text`. A file that could not be read
 * has an empty string here and so does a genuinely empty document, and the
 * two mean completely different things — one is unassessed, the other is a
 * finding. Everything downstream branches on the status, never on whether the
 * text is empty.
 */
export type ExtractedDocument = {
  document: StoredDocument;
  status: TextStatus;
  text: string;
  /** Why it could not be read, for the log and the email. */
  detail?: string;
  /** Shown to the contractor when the file was only read in part. */
  notice?: string;
};

export function isReadable(entry: ExtractedDocument): boolean {
  return entry.status === "ok" || entry.status === "ocr";
}

/**
 * Read reliably enough that NOT finding something in it means something.
 *
 * Deliberately narrower than isReadable. Image recognition drops and mangles
 * words routinely, so its text can show that a subject IS covered — the words
 * are there — but can never show that one is absent. Absence of evidence from
 * OCR is not evidence of absence, and the difference decides whether we are
 * allowed to tell someone a document is missing.
 */
export function isReliable(entry: ExtractedDocument): boolean {
  return entry.status === "ok";
}
