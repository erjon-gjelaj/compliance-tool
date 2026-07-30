"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  FileSignature,
  FileStack,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Users,
} from "lucide-react";

/**
 * The workspace navigation.
 *
 * A client component only because it needs the current path to mark what is
 * active. Everything it links to is a server-rendered page.
 *
 * On a phone it becomes a horizontal scrolling row above the content rather
 * than a hamburger. The audience is filling this in on a job site, and a menu
 * that has to be opened to find out what is in it costs a tap on every
 * navigation — a visible row costs none. There are few enough sections to fit.
 *
 * Deliberately short labels and no descriptions. This is application chrome,
 * not a place to explain the product.
 */

const SECTIONS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/requests", label: "Requests", icon: MessageSquare },
  { href: "/dashboard/documents", label: "Documents", icon: FileStack },
  { href: "/dashboard/programs", label: "Programs", icon: FileSignature },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: CalendarClock },
  { href: "/dashboard/company", label: "Company", icon: Building2 },
  { href: "/dashboard/help", label: "Ask for help", icon: LifeBuoy },
] as const;

export function DashboardNav({
  canManageClients = false,
}: {
  canManageClients?: boolean;
}) {
  const pathname = usePathname();
  const sections = canManageClients
    ? [
        ...SECTIONS.slice(0, 6),
        { href: "/dashboard/clients", label: "Clients", icon: Users },
        ...SECTIONS.slice(6),
      ]
    : SECTIONS;

  /*
   * Overview must match exactly. Every other section owns its subtree, so a
   * request detail page keeps "Requests" lit — otherwise navigating into a
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
