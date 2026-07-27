import { NextResponse } from "next/server";

import { signedUrlFor } from "@/lib/documents";
import { currentClient } from "@/lib/auth/session";
import { getDocumentForEmail } from "@/lib/dashboard";

/**
 * Handing a client back one of their own files.
 *
 * The bucket is private and has no public URLs, so this route is the only way
 * bytes come out of it for a client. It does not proxy the file: it checks
 * who is asking, confirms the document is theirs, mints a signed URL that
 * lives a few minutes, and redirects. The bytes go browser-to-Supabase, so a
 * 10MB download never occupies a serverless function.
 *
 * The order of the two checks is the point. Session first, then a lookup that
 * filters on that session's address in the query — never a fetch by id
 * followed by a comparison. Document ids are uuids but they are not secrets;
 * they are printed into the markup of the page that links here.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentClient();

  // 401 rather than a redirect to sign-in: this is a file endpoint, and a
  // signed-out request for it is usually a stale tab rather than a person
  // navigating.
  if (!session) {
    return new NextResponse("Sign in to download your documents.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { id } = await params;
  const document = await getDocumentForEmail(session.email, id);

  // Not found and not yours are the same response deliberately. Telling the
  // two apart would confirm that a guessed id belongs to somebody.
  if (!document) {
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const url = await signedUrlFor(document.storage_path);

  if (!url) {
    return new NextResponse("That file could not be opened right now.", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // no-store matters more than usual here: the redirect target is a
  // credential with a short life, and a cached 307 would hand it to the next
  // person on a shared machine.
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "no-store, private" },
  });
}
