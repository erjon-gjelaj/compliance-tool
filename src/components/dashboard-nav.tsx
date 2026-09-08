"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, FileStack, LayoutDashboard, Users } from "lucide-react";

/**
 * The workspace navigation.
 *
 * Three sections, down from seven.
 *
 * The seven were each a reasonable idea and together they were a filing
 * cabinet. "Approval projects", "Generate documents", "Documents" and
 * "Maintenance" were four doors onto the same pieces of paper — a hazard
 * communication program was a row in the first, a card in the second, a file
 * in the third and a date in the fourth. Somebody looking for it had to know
 * which of our four models they were in.
 *
 * The audience is an owner or an office manager at a ten-person contractor,
 * usually on a phone, usually because a plant has given them a deadline. They
 * do not have a model of our domain and should not need one. So: where am I
 * (Home), what paperwork is outstanding (Paperwork), and how do I reach a
 * person (Help).
 *
 * Company moved into the header. It is filled in once and then rarely
 * touched, and a permanent slot in the navigation implied it needed attention
 * it does not.
 *
 * The old routes still exist and still work — nothing anybody bookmarked is
 * broken. They are simply no longer four competing front doors.
 *
 * A client component only because it needs the current path to mark what is
 * active. Everything it links to is server-rendered.
 *
 * On a phone it is a horizontal row rather than a hamburger. A menu that has
 * to be opened to find out what is in it costs a tap on every navigation; at
 * three items a visible row costs none.
 */

const SECTIONS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/documents", label: "Paperwork", icon: FileStack },
  { href: "/dashboard/help", label: "Help", icon: CircleHelp },
] as const;

export function DashboardNav({
  canManageClients = false,
}: {
  canManageClients?: boolean;
}) {
  const pathname = usePathname();
  const sections = canManageClients
    ? [
        ...SECTIONS,
        { href: "/dashboard/clients", label: "Clients", icon: Users },
      ]
    : SECTIONS;

  /*
   * Overview must match exactly. Every other section owns its subtree, so a
   * request detail page keeps its parent lit; otherwise navigating into a
   * thread would appear to leave the section it is in.
   */
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <nav aria-label="Workspace" className="lg:w-52 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto border-b border-zinc-dust lg:flex-col lg:gap-0.5 lg:border-b-0">
        {sections.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);

          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 border-l-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "border-verdigris bg-paper font-medium text-millscale"
                    : "border-transparent text-slate-wash hover:text-millscale"
                }`}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
