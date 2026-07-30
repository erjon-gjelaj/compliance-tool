"use client";

import { useActionState } from "react";

import {
  inviteClient,
  saveConsultantBrand,
  type ClientState,
} from "@/app/dashboard/clients/actions";
import { SubmitButton } from "@/components/submit-button";

const initial: ClientState = { status: "editing" };
const field =
  "mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale";

export function ConsultantBrandForm({ value }: { value: string }) {
  const [state, action] = useActionState(saveConsultantBrand, initial);
  return (
    <form action={action} className="border border-zinc-dust bg-paper p-5">
      <label htmlFor="brand_name" className="type-label block text-millscale">
        Name printed on client exports
      </label>
      <input
        id="brand_name"
        name="brand_name"
        required
        maxLength={120}
        defaultValue={value}
        className={field}
      />
      {state.error ? <p className="mt-3 text-sm text-rust-flag">{state.error}</p> : null}
      {state.status === "saved" ? <p className="mt-3 text-sm text-verdigris">Saved.</p> : null}
      <SubmitButton pendingLabel="Saving…" className="btn-primary mt-4">
        Save export brand
      </SubmitButton>
    </form>
  );
}

export function InviteClientForm() {
  const [state, action] = useActionState(inviteClient, initial);
  return (
    <form action={action} className="border border-zinc-dust bg-paper p-5">
      <h2 className="type-h3 text-millscale">Invite a client</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="company_name" className="type-label block text-millscale">
            Company name
          </label>
          <input id="company_name" name="company_name" required maxLength={200} className={field} />
        </div>
        <div>
          <label htmlFor="client_email" className="type-label block text-millscale">
            Owner email
          </label>
          <input id="client_email" name="client_email" type="email" required maxLength={254} className={field} />
        </div>
      </div>
      {state.error ? <p className="mt-3 text-sm text-rust-flag">{state.error}</p> : null}
      {state.status === "sent" ? (
        <p className="mt-3 text-sm text-verdigris">Workspace created and invitation sent.</p>
      ) : null}
      <SubmitButton pendingLabel="Sending…" className="btn-primary mt-4">
        Create workspace and invite
      </SubmitButton>
    </form>
  );
}
