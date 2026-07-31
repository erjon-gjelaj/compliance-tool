# Dashboard customer-journey audit

## Current model and route map

- `submissions` already behaves like an approval project: it records hiring
  client, platform, target date, trade, intake progress, uploaded evidence and
  review status. A new project table is not justified for this redesign.
- `requirement_sets` and `requirements` are the current project checklist, but
  are company-scoped and are not yet consistently joined to one submission.
- `generated_documents` represents self-service program work and can optionally
  retain submission, request, platform and hiring-client associations.
- `service_requests` is a paid assistance thread, not the primary project
  object. Treating it as one would mix document work with approval preparation.

## Implementation assessment

### Fully implemented

- Config-driven requirement and program catalogs, truthful uncertainty states,
  four real self-service generators, generated-document versions and downloads.
- Uploaded document library, unreadable-file state, OCR/classification storage,
  requirement generation, maintenance dates, and structured insurance,
  statistics and training records.
- Server-side workspace authorization and an authenticated dashboard layout.

### Partially implemented

- Overview derives a next action, but prioritizes old intake/review concepts and
  does not summarize the active approval project or generator availability.
- The requirement checklist exists, but every program receives the same generic
  "Prepare a draft" link even though only four generators exist.
- Training has a sign-in-sheet generator, while its upload path and existing
  evidence are not presented as one workflow.
- Insurance and statistics render parsed rows, but their empty states do not
  provide an obvious upload action or explain the subsequent workflow.
- Maintenance is implemented, but `/dashboard/calendar` duplicates the route
  with contradictory naming.

### Not implemented

- A first-class approval-project index and project-oriented navigation.
- One coherent program state model covering uploaded, generated, available,
  unavailable and requirement-confirmation states.
- Search/filtering for the full configured program catalog.
- Direct correction forms for uncertain parsed insurance/statistics fields.
- A project selector backed by an explicit active-project preference.

### Implemented without enough customer benefit

- Six evidence-category pages received equal global navigation weight even
  though they are supporting parts of an approval project.
- Overview statistics and repeated submission activity consume attention
  without resolving the customer's next decision.
- Generated programs appear both in Programs and Documents with overlapping
  calls to action.

### Duplicated or contradictory workflows

- `/dashboard/file`, `/dashboard/programs`, and `/dashboard/documents` each
  present written-program work differently.
- `/dashboard/calendar` renders `/dashboard/maintenance` under a different
  title.
- Approval intake lives in submissions, paid assistance in requests, and the
  dashboard labels both as generic "requests."

## Revised information architecture

- **Home**: active-project context, one next action, attention items, category
  summary, ready/in-progress documents, relevant generators and deadlines.
- **Approval projects**: submissions as projects; each project links to its
  evidence/review and the company requirement checklist.
- **Generate documents**: the canonical generator catalog, with recommended,
  available, ready and unavailable states. Specific actions retain program id.
- **Documents**: generated outputs, uploaded evidence and files needing
  attention; no generator catalog duplication.
- **Maintenance**, **Company**, **Help**: global supporting destinations.
- Training, insurance, safety statistics and requirements remain project/file
  sections reached from project context rather than equal global destinations.

## Smallest viable backend follow-up

No migration is required for the interface consolidation. A later iteration
should add an explicit `requirement_sets.submission_id` (or approval-project id)
and a saved active-project preference. Until then, the interface truthfully
uses the newest submission as current context and labels company-scoped
requirements accordingly.
