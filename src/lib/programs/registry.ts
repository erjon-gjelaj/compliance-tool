import { HAZCOM } from "@/lib/programs/hazcom";
import { isOfferable, isTestable, type ProgramTemplate } from "@/lib/programs/types";

/**
 * The programme library.
 *
 * One entry today. The shape is what matters: adding the next programme is a
 * template file and a line here, with no change to the questionnaire, the
 * validator, the renderers, the storage, or the library UI.
 *
 * Safe to IMPORT from a client component, which is how the questionnaire
 * reads the same definitions the server validates against. It is NOT safe to
 * pass a template through a server/client boundary as a prop: the templates
 * carry functions, and functions cannot be serialised. Pass an id and look it
 * up on the far side.
 */
export const PROGRAMS: ProgramTemplate[] = [HAZCOM];

export function programById(id: string): ProgramTemplate | undefined {
  return PROGRAMS.find((program) => program.id === id);
}

/** What an ordinary customer may generate. */
export function offerablePrograms(): ProgramTemplate[] {
  return PROGRAMS.filter((program) => isOfferable(program.release));
}

/**
 * The programme behind a gap-report finding, if we can prepare one.
 *
 * `requirementId` on the template is the join: the matcher reports a
 * requirement, and this says whether that requirement is something we can
 * produce. A finding with no programme simply has no "prepare this" action.
 */
export function programForRequirement(
  requirementId: string,
): ProgramTemplate | undefined {
  return offerablePrograms().find(
    (program) => program.requirementId === requirementId,
  );
}

/**
 * The programme behind a finding, matched on the requirement's label.
 *
 * A stored review carries the requirement's label, not its id — the schema was
 * designed before generation existed and reviews already in the database
 * cannot grow a field. Matching on the label is therefore the only join
 * available for historical reviews, and it is exact rather than fuzzy: a near
 * match would offer to prepare the wrong programme.
 */
export function programForLabel(label: string) {
  return offerablePrograms().find(
    (program) => program.matchesLabel?.(label) ?? false,
  );
}

export { isOfferable, isTestable };
