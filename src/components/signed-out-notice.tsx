"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";

/**
 * One-time confirmation for an explicit sign-out.
 *
 * It reads the marker in the browser so the public pages remain statically
 * rendered. The marker is removed immediately without navigating, which
 * means refresh and copied links do not repeat the message.
 */
export function SignedOutNotice() {
  const [visible, setVisible] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("signed_out") !== "1") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("signed_out");
    const query = url.searchParams.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${query ? `?${query}` : ""}${url.hash}`,
    );

    // Scheduled because the URL cleanup updates Next's search-param store.
    // Deliberately not cancelled by that update: the notice is the lasting
    // acknowledgement of the marker we just removed.
    window.setTimeout(() => setVisible(true), 0);
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div className="border-b border-verdigris bg-paper" role="status">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <p className="text-sm text-millscale">You&rsquo;ve been signed out.</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-slate-wash transition-colors hover:text-millscale"
          aria-label="Dismiss signed-out message"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
