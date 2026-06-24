import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { canAccessPage } from "@/lib/permissions";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { key: "dashboard", href: "/dashboard", label: "My Dashboard", icon: "🏠" },
  { key: "jobs", href: "/jobs", label: "Jobs", icon: "📁" },
  { key: "ceo-dashboard", href: "/ceo-dashboard", label: "CEO Dashboard", icon: "📊" },
  { key: "production", href: "/production", label: "Production Timeline", icon: "🗓️" },
  { key: "admin", href: "/admin", label: "Admin", icon: "⚙️" },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;

  const visible = await Promise.all(
    NAV.map(async (item) => ({ ...item, allowed: await canAccessPage(role, item.key) }))
  );

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-[rgb(var(--border))] flex flex-col p-4 hidden md:flex">
        <div className="mb-8 px-2">
          <Logo size={28} />
        </div>
        <nav className="flex-1 space-y-1">
          {visible
            .filter((i) => i.allowed)
            .map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="px-2 pt-4 border-t border-[rgb(var(--border))] text-xs text-[rgb(var(--muted))]">
          <div className="font-medium text-sm text-[rgb(var(--fg))]">{session!.user.name}</div>
          <div>{session!.user.designation ?? session!.user.role.replace("_", " ")}</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-[rgb(var(--border))] flex items-center justify-between px-4 md:px-6">
          <div className="md:hidden">
            <Logo size={26} />
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
