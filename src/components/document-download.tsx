"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Spinner } from "@/components/spinner";

/**
 * The download link on a submission's document.
 *
 * Not an instant navigation, which is the reason this exists. The click hits a
 * route handler that checks the session, confirms the document belongs to this
 * address, and asks Supabase to mint a signed URL before it can redirect — on
 * a cold function that is a noticeable pause on a link that looks like it
 * should be immediate, and the reasonable response to a link that appears to
 * do nothing is to click it again.
 *
 * The pending state is time-limited rather than cleared on completion, and
 * that is a real constraint rather than laziness: the navigation ends in a
 * file download, so this page is never unloaded and no load event ever tells
 * us the file arrived. Nothing in the browser reliably reports "the download
 * started". Rather than leave a spinner turning forever on a link whose file
 * downloaded fine, it clears itself after a few seconds — long enough to cover
 * the wait, short enough that a failed click is clickable again.
 */
export function DocumentDownload({
  documentId,
  fileName,
}: {
  documentId: string;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <a
      href={`/api/documents/${documentId}`}
      // The filename is a hint to the browser, not a promise: the response is
      // a redirect to storage, which sets its own disposition.
      download={fileName}
      onClick={() => {
        setBusy(true);
        window.setTimeout(() => setBusy(false), 6000);
      }}
      aria-busy={busy || undefined}
      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-verdigris underline-offset-4 hover:underline"
    >
      {busy ? <Spinner /> : <Download aria-hidden className="h-4 w-4" />}
      {busy ? "Preparing…" : "Download"}
    </a>
  );
}
