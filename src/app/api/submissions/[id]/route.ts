import { NextResponse } from "next/server";
import { deleteSubmission } from "@/lib/documents";

/**
 * Hard-delete for one submission: its row, its document rows, and its files.
 *
 * This exists so a deletion request can actually be honoured today rather
 * than in principle. Someone who uploaded their safety paperwork and then
 * asks for it back is entitled to have it gone, and that has to be something
 * a person can carry out in a minute — not a function nothing calls.
 *
 * Guarded by a shared secret in `ADMIN_SECRET`, which is the same mechanism
 * the internal submissions page will use (task 031). There is deliberately
 * no auth system here: no accounts, no sessions, one secret held by the one
 * person who needs it.
 *
 * When ADMIN_SECRET is unset the route answers 404 rather than 401, so an
 * unconfigured deployment doesn't advertise that this endpoint exists.
 *
 * Usage:
 *   curl -X DELETE https://certloop.net/api/submissions/<id> \
 *     -H "x-admin-secret: $ADMIN_SECRET"
 */

/** Constant-time-ish comparison, so a wrong secret can't be found a character at a time. */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < provided.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.warn(
      "Deletion endpoint called but ADMIN_SECRET is not set; refusing.",
    );
    return new NextResponse(null, { status: 404 });
  }

  const provided = request.headers.get("x-admin-secret") ?? "";

  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  // Cheap shape check before touching the database. The column is a uuid, so
  // anything else is a client error rather than a lookup that finds nothing.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return NextResponse.json(
      { error: "That is not a submission id." },
      { status: 400 },
    );
  }

  try {
    const report = await deleteSubmission(id);
    console.warn(
      `Deleted submission ${id}: ${report.objectsRemoved} file(s) removed.`,
    );
    return NextResponse.json(report);
  } catch (cause) {
    console.error("Deletion failed:", cause);
    return NextResponse.json(
      { error: "Deletion failed. Check the server log." },
      { status: 500 },
    );
  }
}
