import { NextResponse, type NextRequest } from "next/server";

import { currentWorkspace } from "@/lib/workspaces";
import { signedUrlForVersion } from "@/lib/programs/store";

/**
 * Downloads a generated file.
 *
 * Redirects to a five-minute signed URL rather than streaming the bytes, the
 * same shape the upload downloads use. Ownership is confirmed inside
 * signedUrlForVersion by loading the document through the email-filtered
 * reader — a version id appears in page markup and is not a secret.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspace = await currentWorkspace();

  // A signed-out request here is usually a stale tab, so it is a redirect to
  // sign in rather than a bare 401.
  if (!workspace) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") === "docx" ? "docx" : "pdf";

  const url = await signedUrlForVersion({ email: workspace.email, versionId: id, format });

  // Not found and not yours are the same response, so a guessed uuid tells
  // you nothing about whether it is real.
  if (!url) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(url);
}
