"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace } from "@/lib/workspaces";
import {
  deleteMaintenanceDate,
  isIsoDate,
  MAINTENANCE_KINDS,
  saveMaintenanceDate,
  type MaintenanceKind,
} from "@/lib/maintenance";

export type MaintenanceState = {
  status: "editing" | "saved";
  error?: string;
};

export async function saveReminder(
  _previous: MaintenanceState,
  formData: FormData,
): Promise<MaintenanceState> {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const rawTarget = String(formData.get("target") ?? "");
  const [targetType, targetId] = rawTarget.split(":", 2);
  const kind = String(formData.get("kind") ?? "") as MaintenanceKind;
  const dueDate = String(formData.get("due_date") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (
    !["uploaded", "generated"].includes(targetType) ||
    !targetId ||
    !MAINTENANCE_KINDS.includes(kind)
  ) {
    return { status: "editing", error: "Choose a document and reminder type." };
  }
  if (!isIsoDate(dueDate)) {
    return { status: "editing", error: "Choose a real date." };
  }
  if (note.length > 500) {
    return { status: "editing", error: "Keep the note under 500 characters." };
  }

  try {
    const owned = await saveMaintenanceDate({
      email: workspace.email,
      targetType: targetType as "uploaded" | "generated",
      targetId,
      kind,
      dueDate,
      note: note || null,
    });
    if (!owned) {
      return { status: "editing", error: "We couldn't find that document." };
    }
  } catch (cause) {
    console.error("Could not save reminder:", cause);
    return { status: "editing", error: "We couldn't save that reminder." };
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard");
  return { status: "saved" };
}

export async function removeReminder(formData: FormData): Promise<void> {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const id = String(formData.get("id") ?? "");
  if (id) await deleteMaintenanceDate(workspace.email, id);

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard");
}
