"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileStack, LayoutDashboard, LifeBuoy } from "lucide-react";

/**
 * The workspace navigation.
 *
 * A client component only because it needs the current path to mark what is
 * active. Everything it links to is a server-rendered page.
 *
 * On a phone it becomes a horizontal scrolling row above the content rather
 * than a hamburger. The audience is filling this in on a job site, and a menu
 * that has to be opened to find out what is in it costs a tap on every
 * navigation — a visible row costs none.
 *
 * ## Why three sections and not six
 *
 * This was Overview / Requests / Documents / Programs / Company / Ask for
 * help. Six is too many for what is actually here, and two pairs of them
 * were the same thing to the person reading:
 *
 *  - **Documents and Programs.** The documents page already listed generated
 *    programmes at the top and uploaded files below it. A subcontractor does
 *    not hold "documents" and "programs" as separate ideas — they hold
 *    paperwork, some of which they sent us and some of which we made. So
 *    they are one section, and /dashboard/programs becomes what it always
 *    was: the thing you click to start a new one, not a place you live.
 *  - **Requests and Ask for help.** Asking for something and watching what
 *    you asked for are one activity. The help page already listed the open
 *    requests underneath its form, so the split was costing a nav slot to
 *    show the same rows twice.
 *
 * Company left the nav rather than being merged. It is filled in once and
 * then almost never revisited, so it belongs with the account controls in
 * the header — a permanent slot for a page you visit twice implies it needs
 * attention it does not need.
 */

const SECTIONS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/documents", label: "Paperwork", icon: FileStack },
  { href: "/dashboard/requests", label: "Get help", icon: LifeBuoy },
] as const;

/**
 * Sections that own subtrees they do not link to directly.
 *
 * /dashboard/programs is reached from Paperwork, so it must light Paperwork
 * rather than nothing at all — an active state that goes blank mid-journey
 * reads as having left the app.
 */
const ALSO_INSIDE: Record<string, readonly string[]> = {
  "/dashboard/documents": ["/dashboard/programs"],
  "/dashboard/requests": ["/dashboard/help"],
};

export function DashboardNav() {
  const pathname = usePathname();

  /*
   * Overview must match exactly. Every other section owns its subtree, so a
   * request detail page keeps "Get help" lit — otherwise navigating into a
   * thread would appear to leave the section it is in.
   */
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    if (pathname.startsWith(href)) return true;
    return (ALSO_INSIDE[href] ?? []).some((extra) => pathname.startsWith(extra));
  };

  return (
    <nav aria-label="Workspace" className="lg:w-52 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto border-b border-zinc-dust lg:flex-col lg:gap-0.5 lg:border-b-0">
        {SECTIONS.map(({ href, label, icon: Icon }) => {
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
