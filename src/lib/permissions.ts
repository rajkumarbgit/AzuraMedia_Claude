import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Pages every role can always see (no toggle needed)
export const ALWAYS_ALLOWED: Record<Role, string[]> = {
  CEO: ["*"],
  ADMIN: ["admin", "dashboard"],
  PROJECT_MANAGER: ["dashboard"],
  PRODUCTION_LEAD: ["dashboard"],
  OPS: ["dashboard"],
};

export const PAGE_DEFS = [
  { key: "jobs", label: "Job Management" },
  { key: "ceo-dashboard", label: "CEO Dashboard" },
  { key: "production", label: "Production Timeline" },
  { key: "admin", label: "Admin Panel" },
  { key: "dashboard", label: "My Dashboard" },
];

export async function canAccessPage(role: Role, pageKey: string): Promise<boolean> {
  if (role === "CEO") return true;
  if (ALWAYS_ALLOWED[role]?.includes(pageKey)) return true;

  const page = await prisma.page.findUnique({ where: { key: pageKey } });
  if (!page) return false;

  const perm = await prisma.rolePagePermission.findUnique({
    where: { role_pageId: { role, pageId: page.id } },
  });
  return !!perm?.canAccess;
}

export function defaultDashboardPath(role: Role): string {
  switch (role) {
    case "CEO":
      return "/ceo-dashboard";
    case "ADMIN":
      return "/admin";
    case "PROJECT_MANAGER":
      return "/jobs";
    case "PRODUCTION_LEAD":
    case "OPS":
      return "/production";
    default:
      return "/dashboard";
  }
}
