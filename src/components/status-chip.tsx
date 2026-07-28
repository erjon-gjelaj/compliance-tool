import { STATE_LABEL, STATE_TONE, type RequestState } from "@/lib/requests/state";

/**
 * The one status treatment in the product.
 *
 * Every place a request state appears renders this, so the four meanings
 * always look the same. The brief asked for that explicitly, and the reason is
 * that a status a user has to re-learn per screen is not a status.
 *
 * Four tones rather than six: two states that mean the same thing to somebody
 * scanning a list should not be told apart by colour. `action` is the only one
 * that draws the eye, because it is the only one that is their move.
 */
const TONE_CLASS: Record<"action" | "waiting" | "ready" | "done", string> = {
  action: "border-rust-flag bg-rust-flag/8 text-rust-flag",
  waiting: "border-zinc-dust bg-galvanise text-slate-wash",
  ready: "border-verdigris bg-verdigris/8 text-verdigris",
  done: "border-zinc-dust bg-galvanise text-slate-wash",
};

export function StatusChip({ state }: { state: RequestState }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-2.5 py-1 text-xs font-medium ${TONE_CLASS[STATE_TONE[state]]}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}
