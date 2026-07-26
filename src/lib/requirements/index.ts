/**
 * Reference data: what a given trade is commonly asked for on a given
 * platform.
 *
 * PLACEHOLDER. This is deliberately near-empty. The typed, versioned,
 * hand-editable version is task 030, and it needs real human domain research
 * before anything in it can be presented as our understanding of anything.
 *
 * Until then the honest content is "we have not verified this yet", and the
 * prompt is told that where the reference is silent the answer is a question
 * rather than a recollection. That is the whole point of the seam: the model
 * is instructed to prefer this file over its own knowledge, so an empty file
 * produces cautious output rather than confident invention.
 */

export type Platform = "ISNetworld" | "Avetta" | "Both" | "Not sure";

/** Rendered into the prompt. */
export function requirementsFor({
  trade,
  platform,
}: {
  trade: string;
  platform: string;
}): string {
  return [
    "No verified requirements are on file for this trade and platform yet.",
    "",
    `Trade: ${trade}`,
    `Platform: ${platform}`,
    "",
    "TODO-VERIFY: this reference has not been researched. Because it is",
    "empty, you have no verified basis for saying that any particular",
    "document is required of this contractor. Work from what their documents",
    "show and what they told you, and put everything else in",
    "questionsForClient rather than asserting it.",
  ].join("\n");
}
