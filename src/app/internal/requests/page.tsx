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
import { recordManualPayment } from "@/lib/billing/purchases";
import { PROGRAMS_PRODUCT } from "@/lib/billing/catalog";
import { notifyCertLoopReply, notifyPlanGranted } from "@/lib/notify";
import type { EventKind } from "@/lib/requests/state";
import { createAndSendQuote, latestQuote } from "@/lib/quotes";

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

async function sendQuote(formData: FormData) {
  "use server";
  if (!(await hasInternalSession())) redirect("/internal/requests");
  const requestId = String(formData.get("request_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount_dollars"));
  const terms = String(formData.get("terms") ?? "").trim();
  const expiresAt = String(formData.get("expires_at") ?? "");
  if (
    !requestId ||
    !description ||
    !terms ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !expiresAt
  ) {
    throw new Error("Complete every quote field.");
  }
  await createAndSendQuote({
    requestId,
    currency: "USD",
    lines: [
      {
        description,
        quantity: 1,
        unitMinor: Math.round(amount * 100),
      },
    ],
    terms,
    expiresAt: new Date(`${expiresAt}T23:59:59Z`).toISOString(),
  });
  redirect("/internal/requests");
}

/**
 * Confirming a payment that arrived outside any card processor.
 *
 * This is the whole of getting paid without Stripe. An operator looks at
 * their bank, types what it shows, and the entitlement follows from the same
 * ledger a card payment writes to — so a transfer and a card grant the
 * customer exactly the same thing.
 *
 * The reference is required and is what makes it safe to press twice: it is
 * unique in the ledger, so the same transfer recorded again grants nothing.
 * Confirming payments by hand on a busy morning is precisely the workflow
 * where that happens.
 *
 * Nothing here verifies that money moved. Software cannot. The row records
 * that an operator said it did, and when.
 */
async function confirmPayment(formData: FormData) {
  "use server";

  if (!(await hasInternalSession())) redirect("/internal/requests");

  const email = String(formData.get("email") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const amount = Number(formData.get("amount_dollars"));

  if (!email || !reference || !Number.isFinite(amount) || amount < 0) {
    redirect("/internal/requests?payment=incomplete");
  }

  let outcome: "granted" | "already" | "failed";

  try {
    const result = await recordManualPayment({
      email,
      productId: PROGRAMS_PRODUCT.id,
      reference,
      amountCents: Math.round(amount * 100),
    });
    outcome = result.created ? "granted" : "already";

    /*
     * Only on the delivery that created the row. Telling somebody twice that
     * their programs are ready is how a product teaches people its email is
     * noise — and an operator re-entering a reference to check is a normal
     * thing to do.
     */
    if (result.created) {
      try {
        await notifyPlanGranted({ email, programName: null });
      } catch (cause) {
        console.error("Payment recorded, but the email failed:", cause);
      }
    }
  } catch (cause) {
    console.error("Could not record a manual payment:", cause);
    outcome = "failed";
  }

  redirect(`/internal/requests?payment=${outcome}`);
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
          {requests.map(async (request) => {
            const quote = await latestQuote(request.id);
            return (
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
              {/*
                Getting paid without a card processor. The operator sees the
                transfer in their bank and records it here; the customer's
                plan follows automatically.
              */}
              <form action={confirmPayment} className="mt-4 border-t border-zinc-dust pt-4">
                <input type="hidden" name="email" value={request.email} />
                <p className="text-sm font-medium text-millscale">
                  Payment received
                </p>
                <p className="mt-1 text-xs text-slate-wash">
                  Grants the programs to {request.email} and emails them. The
                  reference stops the same transfer counting twice.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    name="reference"
                    required
                    placeholder="Bank reference or check no."
                    className="border border-zinc-dust bg-galvanise px-3 py-2 text-sm"
                  />
                  <input
                    name="amount_dollars"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={(PROGRAMS_PRODUCT.amountCents / 100).toFixed(2)}
                    className="border border-zinc-dust bg-galvanise px-3 py-2 text-sm"
                  />
                </div>
                <SubmitButton pendingLabel="Recording…" className="btn-primary mt-3">
                  Confirm payment and grant access
                </SubmitButton>
              </form>

              <form action={sendQuote} className="mt-4 border-t border-zinc-dust pt-4">
                <input type="hidden" name="request_id" value={request.id} />
                <p className="text-sm font-medium text-millscale">
                  {quote
                    ? `Latest quote: version ${quote.version}`
                    : "Prepare a quote"}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input name="description" required placeholder="Scope of work" className="border border-zinc-dust bg-galvanise px-3 py-2 text-sm" />
                  <input name="amount_dollars" type="number" min="0" step="0.01" required placeholder="Amount in USD" className="border border-zinc-dust bg-galvanise px-3 py-2 text-sm" />
                  <input name="expires_at" type="date" required className="border border-zinc-dust bg-galvanise px-3 py-2 text-sm" />
                  <textarea name="terms" required placeholder="Acceptance terms" className="border border-zinc-dust bg-galvanise px-3 py-2 text-sm" />
                </div>
                <SubmitButton pendingLabel="Sending quote…" className="btn-primary mt-3">
                  Send stored quote
                </SubmitButton>
              </form>
            </li>
          )})}
        </ul>
      )}
    </main>
  );
}
