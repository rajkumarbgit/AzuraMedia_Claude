import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessPage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { presenceStatus } from "@/lib/clock";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";
import { Avatar } from "@/components/ui";
import { SidebarNav, type NavItem } from "@/components/SidebarNav";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";

const NAV: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "My Dashboard", iconName: "LayoutDashboard" },
  { key: "jobs", href: "/jobs", label: "Jobs", iconName: "FolderKanban" },
  { key: "ceo-dashboard", href: "/ceo-dashboard", label: "CEO Dashboard", iconName: "TrendingUp" },
  { key: "production", href: "/production", label: "Production Timeline", iconName: "CalendarClock" },
  { key: "portal", href: "/portal", label: "Client Portal", iconName: "Building2" },
  { key: "admin", href: "/admin", label: "Admin", iconName: "Settings" },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;

  const visibleFlags = await Promise.all(NAV.map((item) => canAccessPage(role, item.key)));
  const visible = NAV.filter((_, i) => visibleFlags[i]);

  // Live presence for the current user's own profile block in the sidebar.
  const todayStart = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const [me, todaysLeave] = await Promise.all([
    prisma.user.findUnique({ where: { id: session!.user.id }, select: { lastSeenAt: true } }),
    prisma.leave.findUnique({ where: { userId_date: { userId: session!.user.id, date: todayStart } } }),
  ]);
  const myPresence = presenceStatus(me?.lastSeenAt, !!todaysLeave);

  return (
    <div className="min-h-screen flex">
      <PresenceHeartbeat />
      <aside className="w-64 shrink-0 border-r border-[rgb(var(--border))] flex flex-col gap-1 p-4 hidden md:flex">
        <div className="mb-6 px-2">
          <Logo size={28} />
        </div>
        <SidebarNav items={visible} />
        <div className="flex items-center gap-3 px-2 pt-4 border-t border-[rgb(var(--border))]">
          <Avatar name={session!.user.name ?? "?"} size={38} presence={myPresence} />
          <div className="min-w-0">
            <div className="font-bold text-sm truncate text-[rgb(var(--fg))]">{session!.user.name}</div>
            <div className="text-xs text-[rgb(var(--muted))] truncate">
              {session!.user.designation ?? session!.user.role.replace("_", " ")}
            </div>
          </div>
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
