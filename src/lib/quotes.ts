import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { recordEvent } from "@/lib/requests/store";

export type QuoteLine = {
  description: string;
  quantity: number;
  unitMinor: number;
};

export type Quote = {
  id: string;
  request_id: string;
  version: number;
  currency: string;
  total_minor: number;
  line_items: QuoteLine[];
  terms: string;
  expires_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_by_email: string | null;
};

export async function latestQuote(requestId: string): Promise<Quote | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("request_id", requestId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as Quote | null) ?? null;
}

export async function createAndSendQuote({
  requestId,
  currency,
  lines,
  terms,
  expiresAt,
}: {
  requestId: string;
  currency: string;
  lines: QuoteLine[];
  terms: string;
  expiresAt: string;
}): Promise<Quote> {
  const current = await latestQuote(requestId);
  const totalMinor = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitMinor,
    0,
  );
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      request_id: requestId,
      version: (current?.version ?? 0) + 1,
      currency,
      total_minor: totalMinor,
      line_items: lines,
      terms,
      expires_at: expiresAt,
      sent_at: new Date().toISOString(),
      supersedes_id: current?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not save quote: ${error?.message}`);
  await recordEvent({
    requestId,
    actor: "certloop",
    kind: "quoted",
    body: `Quote version ${data.version} sent.`,
  });
  return data as Quote;
}

export async function acceptQuote({
  requestId,
  quoteId,
  email,
  now = new Date(),
}: {
  requestId: string;
  quoteId: string;
  email: string;
  now?: Date;
}): Promise<"accepted" | "already_accepted"> {
  const current = await latestQuote(requestId);
  if (!current || current.id !== quoteId) {
    throw new Error("Only the current quote can be accepted.");
  }
  if (!current.sent_at) throw new Error("This quote has not been sent.");
  if (current.accepted_at) return "already_accepted";
  if (Date.parse(current.expires_at) < now.getTime()) {
    throw new Error("This quote has expired.");
  }
  const acceptedAt = now.toISOString();
  const termsHash = createHash("sha256")
    .update(
      JSON.stringify({
        requestId,
        quoteId,
        version: current.version,
        currency: current.currency,
        totalMinor: current.total_minor,
        lines: current.line_items,
        terms: current.terms,
      }),
    )
    .digest("hex");
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .update({
      accepted_at: acceptedAt,
      accepted_by_email: email,
      accepted_terms_hash: termsHash,
    })
    .eq("id", quoteId)
    .is("accepted_at", null)
    .select("id");
  if (error) throw new Error(`Could not accept quote: ${error.message}`);
  if (!data || data.length === 0) return "already_accepted";
  await recordEvent({
    requestId,
    actor: "customer",
    kind: "quote_accepted",
    body: `Quote version ${current.version} accepted.`,
  });
  return "accepted";
}
