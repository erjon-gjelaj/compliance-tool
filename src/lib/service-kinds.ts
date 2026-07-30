/**
 * The kinds of help someone can ask for.
 *
 * Split out from lib/service-requests, which is `server-only` because it holds
 * the database access. The form that offers these choices is a client
 * component, and importing the vocabulary from the server module would pull
 * `server-only` into the browser bundle and fail the build — correctly, since
 * the service-role client has no business there.
 *
 * So: names and limits here, where both sides can read them. Queries stay
 * behind the server boundary.
 */

export const SERVICE_KINDS = [
  "document_preparation",
  "rejection_help",
  "professional_review",
  "other",
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

/**
 * Work that still starts a conversation with a person.
 *
 * `document_preparation` remains in ServiceKind because historical request
 * rows use it. New document work goes through /dashboard/programs instead.
 */
export const MANUAL_SERVICE_KINDS = [
  "rejection_help",
  "professional_review",
  "other",
] as const satisfies readonly ServiceKind[];

/** What each request is, in the customer's words rather than the schema's. */
export const SERVICE_LABELS: Record<ServiceKind, string> = {
  document_preparation: "Have a document prepared",
  rejection_help: "Help fixing a rejection",
  professional_review: "A qualified person to review this",
  other: "Something else",
};

export function isServiceKind(value: unknown): value is ServiceKind {
  return (
    typeof value === "string" &&
    (SERVICE_KINDS as readonly string[]).includes(value)
  );
}

export const MAX_SERVICE_NOTE = 2000;
