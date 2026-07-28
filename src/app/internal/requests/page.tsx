import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import {
  closeInternalSession,
  hasInternalSession,
  internalAccessConfigured,
  openInternalSession,
} from "@/lib/internal-auth";
import { SITE_NAME } from "@/lib/constants";
import { SubmitButton } from "@/components/submit-button";
import { StatusChip } from "@/components/status-chip";
import { SERVICE_LABELS } from "@/lib/service-kinds";
import { listAllRequests, recordEvent } from "@/lib/requests/store";
import { notifyCertLoopReply } from "@/lib/notify";
import type { EventKind } from "@/lib/requests/state";

/**
 * The operator console.
 *
 * This is what actually fixes the reported bug. The state model can derive
 * "we replied" perfectly, and it will still say "with CertLoop" forever if
 * replying happens in a mail client and nothing records it. There had to be
 * somewhere in the product to do the work.
 *
 * Unlike the submissions list this page writes, which that page deliberately
 * does not. The difference is what a stray click costs: there it would destroy
 * a customer's uploads, here it appends an event to a log that is append-only
 * and fully visible. A wrong event is corrected by recording the right one.
 */

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const ok = await openInternalSession(String(formData.get("secret") ?? ""));
  redirect(ok ? "/internal/requests" : "/internal/requests?denied=1");
}

async function signOut() {
  "use server";
  await closeInternalSession();
  redirect("/internal/requests");
}

/**
 * Records what we just did.
 *
 * `awaits_reply` is asked for explicitly rather than guessed from the text.
 * "Here's your draft, nothing needed from you" and "we can't start until you
 * send the EMR" are both replies, and they leave the request in opposite
 * states — no amount of reading the prose settles which, so the person writing
 * it says.
 */
async function act(formData: FormData) {
  "use server";

  if (!(await hasInternalSession())) redirect("/internal/requests");

  const requestId = String(formData.get("request_id") ?? "");
  const kind = String(formData.get("kind") ?? "") as EventKind;
  const body = String(formData.get("body") ?? "").trim();
  const awaitsReply = formData.get("awaits_reply") === "on";
  const email = String(formData.get("email") ?? "");

  if (!requestId || !kind) redirect("/internal/requests");

  await recordEvent({
    requestId,
    actor: "certloop",
    kind,
    body: body || null,
    awaitsReply,
  });

  // Only a message is worth mailing about. Picking something up or marking it
  // done is bookkeeping, and an email per state change trains people to ignore
  // the ones that matter.
  if (kind === "certloop_message" && email && body) {
    try {
      await notifyCertLoopReply({ email, requestId, body, awaitsReply });
    } catch (cause) {
      console.error("Could not notify the customer of a reply:", cause);
    }
  }

  redirect("/internal/requests");
}

function Gate({ denied }: { denied: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="border border-zinc-dust bg-paper p-8">
        <Lock aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
        <h1 className="text-xl font-semibold tracking-tight text-millscale">
          {SITE_NAME} internal
        </h1>
        <form action={signIn} className="mt-6">
          <label htmlFor="secret" className="block text-sm font-medium text-millscale">
            Access key
          </label>
          <input
            id="secret"
            name="secret"
            type="password"
            required
            autoComplete="off"
            className="mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
          />
          {denied ? (
            <p role="alert" className="mt-3 text-sm text-rust-flag">
              That key was not accepted.
            </p>
          ) : null}
          <SubmitButton pendingLabel="Checking…" className="btn-primary mt-5 w-full">
            Open
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}

export default async function InternalRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;

  if (!internalAccessConfigured()) return <Gate denied={false} />;
  if (!(await hasInternalSession())) return <Gate denied={Boolean(denied)} />;

  const requests = await listAllRequests();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-millscale">
          Requests
        </h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-slate-wash underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </div>

      {requests.length === 0 ? (
        <p className="mt-8 text-sm text-slate-wash">Nothing has been asked for yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {requests.map((request) => (
            <li key={request.id} className="border border-zinc-dust bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-millscale">
                    {SERVICE_LABELS[request.kind] ?? request.kind}
                  </p>
                  <p className="text-xs text-slate-wash">{request.email}</p>
                </div>
                <StatusChip state={request.status.state} />
              </div>

              <ol className="mt-4 grid gap-2 border-l-2 border-zinc-dust pl-3">
                {request.events.map((event) => (
                  <li key={event.id} className="text-xs text-slate-wash">
                    <span className="text-millscale">
                      {event.actor === "certloop" ? "us" : event.actor}
                    </span>{" "}
                    &middot; {event.kind}
                    {event.awaits_reply ? " (awaiting them)" : ""}
                    {event.body ? (
                      <span className="mt-0.5 block whitespace-pre-wrap text-millscale">
                        {event.body}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>

              <form action={act} className="mt-4 border-t border-zinc-dust pt-4">
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="email" value={request.email} />

                <textarea
                  name="body"
                  rows={3}
                  placeholder="Reply to them…"
                  className="w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
                />

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-millscale">
                    <select
                      name="kind"
                      defaultValue="certloop_message"
                      className="border border-zinc-dust bg-galvanise px-2 py-1.5 text-sm"
                    >
                      <option value="certloop_message">Reply</option>
                      <option value="in_review">Mark in review</option>
                      <option value="draft_ready">Draft ready</option>
                      <option value="completed">Completed</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-millscale">
                    <input type="checkbox" name="awaits_reply" className="h-3.5 w-3.5" />
                    Needs something back from them
                  </label>

                  <SubmitButton pendingLabel="Recording…" className="btn-primary">
                    Record
                  </SubmitButton>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
