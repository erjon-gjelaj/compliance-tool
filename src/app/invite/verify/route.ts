import { NextResponse, type NextRequest } from "next/server";

import { openClientSession } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/tokens";
import { markCompanyInvitationAccepted } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const verified = token ? await verifyToken(token, "company-invite") : null;
  const destination = verified ? "/dashboard/company" : "/sign-in?error=expired";

  if (verified) {
    await markCompanyInvitationAccepted(verified.email);
    await openClientSession(verified.email);
  }

  return NextResponse.redirect(new URL(destination, request.nextUrl.origin), {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}
