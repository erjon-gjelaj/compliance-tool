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
import {
  notifyCertLoopReply,
  notifyPaymentRecorded,
  notifyPlanGranted,
  notifyQuoteSent,
} from "@/lib/notify";
import {
  agreedQuote,
  formatQuote,
  isPaid,
  liveQuote,
  type EventKind,
} from "@/lib/requests/state";
import { getCompanyForEmail, setPlanForEmail } from "@/lib/companies";
import { PLANS, isPlan, planOf, unlocksPreparation } from "@/lib/entitlements";

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

  /*
   * A quote with no price is the one mistake this form can make that would
   * reach a customer looking deliberate: an email saying "here is your price"
   * with nothing in it. The database would reject it, but the operator would
   * see a 500 rather than a reason, so it is caught here and sent back.
   *
   * A single figure is allowed by leaving the high field blank — a fixed price
   * is the common case and making somebody type it twice invites a typo in
   * exactly one of them.
   */
  let amount: { low: number; high: number } | null = null;

  if (kind === "quoted") {
    const low = Number(String(formData.get("amount_low") ?? "").trim());
    const rawHigh = String(formData.get("amount_high") ?? "").trim();
    const high = rawHigh === "" ? low : Number(rawHigh);

    const usable =
      Number.isFinite(low) &&
      Number.isFinite(high) &&
      low >= 0 &&
      high >= low;

    if (!usable) redirect("/internal/requests?bad_amount=1");

    amount = { low: Math.round(low), high: Math.round(high) };
  }

  await recordEvent({
    requestId,
    actor: "certloop",
    kind,
    body: body || null,
    awaitsReply,
    amount,
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

  /*
   * A price and a payment are both worth an email, for the opposite reason
   * bookkeeping is not: each one asks the customer to do something, or tells
   * them they no longer have to. Neither failure is allowed to undo the
   * event — it is already recorded, and reporting a failure here would send
   * the operator to look for a quote that was in fact sent.
   */
  if (kind === "quoted" && email && amount) {
    try {
      await notifyQuoteSent({
        email,
        requestId,
        quote: formatQuote({ amount_low: amount.low, amount_high: amount.high })!,
        note: body || null,
      });
    } catch (cause) {
      console.error("Could not notify the customer of a quote:", cause);
    }
  }

  if (kind === "payment_recorded" && email) {
    try {
      await notifyPaymentRecorded({ email, requestId, quote: body || null });
    } catch (cause) {
      console.error("Could not notify the customer of a payment:", cause);
    }
  }

  redirect("/internal/requests");
}

/**
 * Grants or removes a plan.
 *
 * Separate from `act` because it is not an event on a request — it changes
 * what an address is entitled to, everywhere, for good. Mixing it into the
 * request form would let a mis-selected dropdown silently upgrade somebody
 * while the operator thought they were writing a reply.
 */
async function grantPlan(formData: FormData) {
  "use server";

  if (!(await hasInternalSession())) redirect("/internal/requests");

  const email = String(formData.get("email") ?? "").trim();
  const plan = String(formData.get("plan") ?? "");

  if (!email || !isPlan(plan)) redirect("/internal/requests");

  /*
   * The redirect is deliberately outside the try. `redirect()` works by
   * throwing, so calling it inside would land in the catch below and report a
   * failure for a grant that had just succeeded.
   */
  let outcome: "granted" | "no_company" | "plan_failed";

  /*
   * Read before writing, so the email can be decided on what actually
   * changed. A plan set to the value it already held, or lowered, is
   * bookkeeping — and "good news, your account changed" for a downgrade is
   * worse than saying nothing.
   */
  const adds = unlocksPreparation(planOf(await getCompanyForEmail(email)), plan);

  try {
    // No company row means nothing was granted. Saying so beats a success
    // message for a change that did not happen.
    outcome = (await setPlanForEmail(email, plan)) ? "granted" : "no_company";
  } catch (cause) {
    console.error("Could not set a plan:", cause);
    outcome = "plan_failed";
  }

  /*
   * The last silent step in the money path, now that a plan gates something.
   * A quote is emailed and a payment is emailed; granting the plan is the
   * moment the customer can finally act on what they bought, and it used to
   * say nothing at all.
   *
   * A failure here does not change the outcome. The grant is already made,
   * and reporting an email problem as a grant problem would send the operator
   * to re-grant something that worked.
   */
  if (outcome === "granted" && adds) {
    try {
      await notifyPlanGranted({ email, programName: null });
    } catch (cause) {
      console.error("Could not tell the customer their plan was granted:", cause);
    }
  }

  redirect(`/internal/requests?${outcome}=1`);
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

/**
 * Outcomes worth telling the operator about, in one list.
 *
 * `no_company` is the one that matters: setting a plan for an address with no
 * company profile changes nothing, and without this the operator would tell a
 * customer they had been upgraded when they had not.
 */
const NOTICES = [
  ["granted", "good", "Plan updated."],
  [
    "no_company",
    "bad",
    "No company profile exists for that address, so nothing was changed. They have to save their company details once before a plan can be attached.",
  ],
  ["plan_failed", "bad", "The plan could not be saved. Check the server log."],
  [
    "bad_amount",
    "bad",
    "That quote needed a price. Enter a low figure, and a high one only if it is a range.",
  ],
] as const satisfies readonly (readonly [string, "good" | "bad", string])[];

export default async function InternalRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    denied?: string;
    granted?: string;
    no_company?: string;
    plan_failed?: string;
    bad_amount?: string;
  }>;
}) {
  const notices = await searchParams;
  const { denied } = notices;

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

      {NOTICES.map(([key, tone, text]) =>
        notices[key] ? (
          <p
            key={key}
            role="status"
            className={`mt-4 border-l-2 px-3 py-2 text-sm ${
              tone === "bad"
                ? "border-rust-flag bg-paper text-rust-flag"
                : "border-verdigris bg-paper text-millscale"
            }`}
          >
            {text}
          </p>
        ) : null,
      )}

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

              {/*
               * Where the money stands, in one line, read from the log rather
               * than from any stored field. "Quoted but unanswered" and
               * "accepted but unpaid" are the two states an operator chases,
               * so they are the two this is built to make obvious.
               */}
              <p className="mt-3 text-xs text-slate-wash">
                {(() => {
                  const open = liveQuote(request.events);
                  const agreed = agreedQuote(request.events);
                  const paid = isPaid(request.events);

                  /*
                   * The open quote is reported first when there is one, even
                   * on a request that is already paid. Re-quoting after
                   * payment is how extra work gets agreed, and a line that
                   * said only "Paid" would hide the fact that a second price
                   * is sitting unanswered — the operator would think there
                   * was nothing to chase.
                   */
                  const settled = paid
                    ? `Paid${agreed ? ` — ${formatQuote(agreed)}` : ""}.`
                    : agreed
                      ? `Accepted ${formatQuote(agreed)} — invoice and record the payment.`
                      : null;

                  if (open) {
                    const outstanding = `Quoted ${formatQuote(open)} — waiting on their answer.`;
                    return settled ? `${settled} ${outstanding}` : outstanding;
                  }

                  return settled ?? "No price quoted yet.";
                })()}
              </p>

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
                      <option value="quoted">Send a price</option>
                      <option value="payment_recorded">Payment received</option>
                      <option value="in_review">Mark in review</option>
                      <option value="draft_ready">Draft ready</option>
                      <option value="completed">Completed</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>

                  {/*
                   * Always visible rather than revealed by the dropdown. This
                   * form has no client JavaScript at all, and adding some to
                   * hide two number fields would be the only script on the
                   * page — the labels say what they are for.
                   */}
                  <span className="flex items-center gap-1.5 text-sm text-millscale">
                    <label htmlFor={`low-${request.id}`} className="text-slate-wash">
                      $
                    </label>
                    <input
                      id={`low-${request.id}`}
                      name="amount_low"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      placeholder="low"
                      className="w-20 border border-zinc-dust bg-galvanise px-2 py-1.5 text-sm"
                    />
                    <span aria-hidden className="text-slate-wash">
                      &ndash;
                    </span>
                    <input
                      aria-label="High end of the price range, if it is a range"
                      name="amount_high"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      placeholder="high"
                      className="w-20 border border-zinc-dust bg-galvanise px-2 py-1.5 text-sm"
                    />
                  </span>

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
               * Its own form, deliberately. This is the only control on the
               * page that changes something permanent about an address rather
               * than appending to a log, so it cannot be triggered by the
               * button that records a reply.
               */}
              <form
                action={grantPlan}
                className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-dust pt-3"
              >
                <input type="hidden" name="email" value={request.email} />
                <span className="text-xs text-slate-wash">Plan for this address</span>
                <select
                  name="plan"
                  defaultValue="contractor"
                  aria-label={`Plan for ${request.email}`}
                  className="border border-zinc-dust bg-galvanise px-2 py-1 text-sm"
                >
                  {PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
                <SubmitButton
                  pendingLabel="Saving…"
                  className="border border-zinc-dust px-3 py-1 text-sm text-millscale transition-colors hover:border-verdigris"
                >
                  Set plan
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
