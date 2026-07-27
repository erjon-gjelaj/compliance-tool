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
};

export function isReadable(entry: ExtractedDocument): boolean {
  return entry.status === "ok" || entry.status === "ocr";
}
