import MaintenancePage from "../maintenance/page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Calendar",
  description: "Document expiries, reviews, deadlines, and recurring work.",
  path: "/dashboard/calendar",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return <MaintenancePage />;
}
