"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, TrendingUp, CalendarClock, Settings, Building2 } from "lucide-react";

const ICONS = {
  LayoutDashboard,
  FolderKanban,
  TrendingUp,
  CalendarClock,
  Settings,
  Building2,
};

export type NavItem = {
  key: string;
  href: string;
  label: string;
  iconName: keyof typeof ICONS;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1.5">
      {items.map((item) => {
        const Icon = ICONS[item.iconName];
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${
              active
                ? "bg-brand-500 text-white shadow-primary"
                : "text-[rgb(var(--fg))]/80 hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <Icon size={19} className={active ? "text-white shrink-0" : "text-brand-500 shrink-0"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
