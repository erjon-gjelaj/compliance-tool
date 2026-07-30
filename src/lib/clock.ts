export type ClockState =
  | "overdue"
  | "due_soon"
  | "upcoming"
  | "scheduled"
  | "no_date";

export type ClockResult = {
  state: ClockState;
  daysUntil: number | null;
  reminderMilestones: Array<60 | 30 | 7>;
};

function dayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 86_400_000) : null;
}

export function clockState(
  date: string | null | undefined,
  today: string,
): ClockResult {
  if (!date) {
    return { state: "no_date", daysUntil: null, reminderMilestones: [] };
  }
  const due = dayNumber(date);
  const start = dayNumber(today);
  if (due === null || start === null) {
    return { state: "no_date", daysUntil: null, reminderMilestones: [] };
  }
  const daysUntil = due - start;
  const state: ClockState =
    daysUntil < 0
      ? "overdue"
      : daysUntil <= 14
        ? "due_soon"
        : daysUntil <= 60
          ? "upcoming"
          : "scheduled";
  const reminderMilestones = ([60, 30, 7] as const).filter(
    (milestone) => daysUntil <= milestone && daysUntil >= 0,
  );
  return { state, daysUntil, reminderMilestones };
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function clockLabel(result: ClockResult): string {
  switch (result.state) {
    case "overdue":
      return `${Math.abs(result.daysUntil ?? 0)} days overdue`;
    case "due_soon":
      return result.daysUntil === 0
        ? "Due today"
        : `Due in ${result.daysUntil} days`;
    case "upcoming":
      return `Upcoming in ${result.daysUntil} days`;
    case "scheduled":
      return "Scheduled";
    case "no_date":
      return "Date needed";
  }
}
