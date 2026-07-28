import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { ServiceKind } from "@/lib/service-kinds";
import {
  deriveStatus,
  type EventKind,
  type RequestEvent,
  type RequestStatus,
} from "@/lib/requests/state";

/**
 * Reading and appending to the request log.
 *
 * There is deliberately no function here that sets a status. State is a
 * function of the events (see state.ts), so the only write is "record what
 * happened". If a screen shows the wrong thing, the fix is a missing event,
 * never a correction to a label.
 */

function emailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export type RequestRow = {
  id: string;
  created_at: string;
  email: string;
  company_id: string | null;
  submission_id: string | null;
  kind: ServiceKind;
  note: string | null;
};

export type RequestWithState = RequestRow & {
  status: RequestStatus;
  events: RequestEvent[];
};

/**
 * Every request for an address, with its state worked out.
 *
 * One query for the requests and one for all their events, rather than a
 * query per request. A contractor with a dozen open requests should not cost
 * thirteen round trips to render a list.
 */
export async function listRequestsForEmail(
  email: string,
): Promise<RequestWithState[]> {
  const supabase = getSupabaseAdminClient();

  const { data: requests, error } = await supabase
    .from("service_requests")
    .select("id, created_at, email, company_id, submission_id, kind, note")
    .ilike("email", emailPattern(email))
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn(`Could not list requests: ${error.message}`);
    return [];
  }

  const rows = (requests ?? []) as RequestRow[];
  if (rows.length === 0) return [];

  const { data: events, error: eventError } = await supabase
    .from("request_events")
    .select("*")
    .in(
      "request_id",
      rows.map((row) => row.id),
    )
    .order("created_at", { ascending: true });

  if (eventError) {
    console.warn(`Could not list request events: ${eventError.message}`);
  }

  const byRequest = new Map<string, RequestEvent[]>();
  for (const event of (events ?? []) as RequestEvent[]) {
    const list = byRequest.get(event.request_id) ?? [];
    list.push(event);
    byRequest.set(event.request_id, list);
  }

  return rows.map((row) => {
    const own = byRequest.get(row.id) ?? [];
    return { ...row, events: own, status: deriveStatus(own) };
  });
}

/**
 * One request, but only if this address owns it.
 *
 * Filtered on the address in the query rather than fetched and checked
 * afterwards, for the reason recorded in lib/dashboard: a missed filter here
 * returns nothing, a missed check would return someone else's conversation.
 */
export async function getRequestForEmail(
  email: string,
  requestId: string,
): Promise<RequestWithState | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("service_requests")
    .select("id, created_at, email, company_id, submission_id, kind, note")
    .eq("id", requestId)
    .ilike("email", emailPattern(email))
    .maybeSingle();

  if (error) {
    console.warn(`Could not read request ${requestId}: ${error.message}`);
    return null;
  }

  if (!data) return null;

  const events = await listEvents(requestId);

  return { ...(data as RequestRow), events, status: deriveStatus(events) };
}

export async function listEvents(requestId: string): Promise<RequestEvent[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("request_events")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(`Could not read events for ${requestId}: ${error.message}`);
    return [];
  }

  return (data ?? []) as RequestEvent[];
}

/**
 * Records that something happened.
 *
 * The only write path. `awaitsReply` is only meaningful on a certloop_message
 * and is forced false otherwise, so a stray true cannot park a request on the
 * customer when nobody asked them anything.
 */
export async function recordEvent({
  requestId,
  actor,
  kind,
  body,
  awaitsReply = false,
}: {
  requestId: string;
  actor: "customer" | "certloop" | "system";
  kind: EventKind;
  body?: string | null;
  awaitsReply?: boolean;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("request_events").insert({
    request_id: requestId,
    actor,
    kind,
    body: body?.slice(0, 4000) || null,
    awaits_reply: kind === "certloop_message" ? awaitsReply : false,
  });

  if (error) {
    throw new Error(`Could not record that: ${error.message}`);
  }
}

/**
 * Every request, for the operator console.
 *
 * The one function in this file that does not filter by address, and it is
 * only ever called from behind the ADMIN_SECRET gate. Kept at the bottom,
 * separate from the customer-facing reads above, so it is obvious which is
 * which — the whole access model of the customer functions is that the email
 * is in the query, and a helper without one sitting among them is how that
 * eventually gets copied by mistake.
 */
export async function listAllRequests(): Promise<RequestWithState[]> {
  const supabase = getSupabaseAdminClient();

  const { data: requests, error } = await supabase
    .from("service_requests")
    .select("id, created_at, email, company_id, submission_id, kind, note")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn(`Could not list requests: ${error.message}`);
    return [];
  }

  const rows = (requests ?? []) as RequestRow[];
  if (rows.length === 0) return [];

  const { data: events } = await supabase
    .from("request_events")
    .select("*")
    .in(
      "request_id",
      rows.map((row) => row.id),
    )
    .order("created_at", { ascending: true });

  const byRequest = new Map<string, RequestEvent[]>();
  for (const event of (events ?? []) as RequestEvent[]) {
    const list = byRequest.get(event.request_id) ?? [];
    list.push(event);
    byRequest.set(event.request_id, list);
  }

  return rows.map((row) => {
    const own = byRequest.get(row.id) ?? [];
    return { ...row, events: own, status: deriveStatus(own) };
  });
}
