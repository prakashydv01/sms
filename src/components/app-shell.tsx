import Link from "next/link";
import { LogoutButton } from "./logout-button";

export function AppShell({
  schoolName,
  userName,
  activeNav,
  children,
}: {
  schoolName?: string;
  userName?: string;
  activeNav?: "students" | "fees" | "classes";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
            S
          </div>
          <span className="truncate text-sm font-semibold text-slate-900">
            {schoolName ?? "School Management System"}
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4 text-sm">
          <NavLink
            href="/students"
            label="Students"
            active={activeNav === "students"}
            icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
          <NavLink
            href="/classes"
            label="Classes"
            active={activeNav === "classes"}
            icon="M12 6.253v13M12 6.253C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s4.332.477 5.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
          <NavLink
            href="/fees"
            label="Fees"
            active={activeNav === "fees"}
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 2v8m0 0v2m0-2c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <NavLink href="#" label="Attendance" disabled icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </nav>

        <div className="border-t border-slate-200 p-3">
          {userName && (
            <div className="mb-2 truncate px-2 text-xs text-slate-500">{userName}</div>
          )}
          <LogoutButton />
        </div>
      </aside>

      <main className="ml-56 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  label,
  active,
  disabled,
  icon,
}: {
  href: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  icon: string;
}) {
  const iconEl = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={icon} />
    </svg>
  );

  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-slate-300">
        {iconEl}
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 font-medium transition-colors ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {iconEl}
      {label}
    </Link>
  );
}