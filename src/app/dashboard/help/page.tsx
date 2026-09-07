import { redirect } from "next/navigation";

/**
 * Kept only to redirect.
 *
 * The help form and the request list merged into /dashboard/requests. This
 * path still exists because it is linked from the review panel, from the
 * programmes page, and from emails already sitting in people's inboxes —
 * deleting it would turn all of those into a 404 for the sake of removing a
 * file.
 *
 * `?submission=` is carried across, since that is what tells the form which
 * review the person is asking about. Dropping it would silently detach the
 * request from the thing that prompted it.
 */
export default async function HelpRedirect({
  searchParams,
}: {
  searchParams: Promise<{ submission?: string }>;
}) {
  const { submission } = await searchParams;

  redirect(
    submission
      ? `/dashboard/requests?submission=${encodeURIComponent(submission)}`
      : "/dashboard/requests",
  );
}
