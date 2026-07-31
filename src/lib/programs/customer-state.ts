export type CustomerProgramState =
  | "not_applicable"
  | "confirm_requirement"
  | "revision_needed"
  | "ready"
  | "started"
  | "uploaded"
  | "generate"
  | "requested"
  | "unavailable";

export type CustomerProgramAction = {
  state: CustomerProgramState;
  label: string;
  href: string | null;
};

/**
 * One truthful state and action for a catalog program. This is deliberately a
 * pure view model: no page gets to imply generator availability from a missing
 * requirement alone.
 */
export function customerProgramAction(input: {
  programKey: string;
  programTitle: string;
  generatorId?: string;
  documentId?: string;
  uploaded?: boolean;
  started?: boolean;
  revisionNeeded?: boolean;
  requested?: boolean;
  applicability?: "included" | "unknown" | "not_applicable";
}): CustomerProgramAction {
  if (input.applicability === "not_applicable") return { state: "not_applicable", label: "Not applicable", href: null };
  if (input.revisionNeeded && input.documentId) return { state: "revision_needed", label: "Update document", href: `/dashboard/documents/${input.documentId}` };
  if (input.documentId) return { state: "ready", label: "Download or update", href: `/dashboard/documents/${input.documentId}` };
  if (input.started && input.generatorId) return { state: "started", label: "Continue", href: `/dashboard/programs/${input.generatorId}` };
  if (input.uploaded) return { state: "uploaded", label: "View uploaded file", href: "/dashboard/documents" };
  if (input.applicability === "unknown") return { state: "confirm_requirement", label: "Confirm requirement", href: "/dashboard/projects/requirements" };
  if (input.generatorId) return { state: "generate", label: "Generate", href: `/dashboard/programs/${input.generatorId}` };
  if (input.requested) return { state: "requested", label: "Request sent", href: "/dashboard/help" };
  return { state: "unavailable", label: "Request this program", href: `/dashboard/help?program=${encodeURIComponent(input.programTitle)}` };
}
