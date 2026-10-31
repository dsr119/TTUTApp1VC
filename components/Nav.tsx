"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; icon: string; badge?: number };

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  clock: "M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z",
  chat: "M4 5h16v11H8l-4 4z",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 8a5 5 0 0 1 0 8",
  people: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0",
  check: "M5 13l4 4L19 7",
  table: "M3 5h18v14H3zM3 10h18M9 5v14",
  dollar: "M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6",
  download: "M12 4v12m0 0-4-4m4 4 4-4M4 20h16",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  logout: "M15 12H3m0 0 4-4m-4 4 4 4M13 4h6v16h-6",
  child: "M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 22v-6l-3-4 7-2 7 2-3 4v6",
};

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ml-auto rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white">{n > 99 ? "99+" : n}</span>;
}

export function Nav({
  userName,
  isAdmin,
  isOwner,
  unread,
  pending,
  signOut,
}: {
  userName: string;
  isAdmin: boolean;
  isOwner: boolean;
  unread: number;
  pending: number;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const main: Item[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/time", label: "Time", icon: "clock" },
    { href: "/chat", label: "Chat", icon: "chat", badge: unread },
    { href: "/updates", label: "Updates", icon: "megaphone" },
    { href: "/directory", label: "Directory", icon: "people" },
  ];
  const more: Item[] = [{ href: "/time-off", label: "Request time off", icon: "calendar" }];
  const admin: Item[] = isAdmin
    ? [
        { href: "/admin/approvals", label: "Approvals", icon: "check", badge: pending },
        { href: "/admin/hours", label: "All hours", icon: "table" },
        { href: "/admin/export", label: "Payroll export", icon: "download" },
        { href: "/admin/kids", label: "Kids", icon: "child" },
        ...(isOwner
          ? [
              { href: "/admin/rates", label: "Rates & services", icon: "dollar" },
              { href: "/admin/people", label: "People", icon: "user" },
            ]
          : []),
      ]
    : [];

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const link = (item: Item, onClick?: () => void) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
        active(item.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon name={item.icon} />
      {item.label}
      <Badge n={item.badge} />
    </Link>
  );

  const signOutForm = (
    <form action={signOut}>
      <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
        <Icon name="logout" />
        Sign out
      </button>
    </form>
  );

  return (
    <>
      {/* Desktop sidebar (admins on laptops) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-semibold text-brand-700">Connect Team</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {main.map((i) => link(i))}
          <div className="mt-4 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">More</div>
          {more.map((i) => link(i))}
          {admin.length > 0 && (
            <>
              <div className="mt-4 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Admin</div>
              {admin.map((i) => link(i))}
            </>
          )}
        </nav>
        <div className="border-t border-slate-200 pt-3">
          <div className="truncate px-3 pb-2 text-sm text-slate-500">{userName}</div>
          {signOutForm}
        </div>
      </aside>

      {/* Mobile top bar with hamburger menu (staff on phones) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="flex items-center gap-2 font-semibold text-brand-700">
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          Connect Team
        </span>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="relative rounded-lg p-1 text-slate-600">
          <Icon name="menu" className="h-6 w-6" />
          {pending > 0 && <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-rose-600" />}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="truncate font-medium">{userName}</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-1 text-slate-500">
                <Icon name="close" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {more.map((i) => link(i, () => setOpen(false)))}
              {admin.length > 0 && (
                <>
                  <div className="mt-4 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Admin</div>
                  {admin.map((i) => link(i, () => setOpen(false)))}
                </>
              )}
            </nav>
            <div className="border-t border-slate-200 pt-3">{signOutForm}</div>
          </div>
        </div>
      )}

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {main.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(item.href) ? "text-brand-700" : "text-slate-500"}`}
          >
            <Icon name={item.icon} className="h-6 w-6" />
            {item.label}
            {!!item.badge && <span className="absolute top-1 right-[calc(50%-18px)] h-2.5 w-2.5 rounded-full bg-rose-600" />}
          </Link>
        ))}
      </nav>
    </>
  );
}
