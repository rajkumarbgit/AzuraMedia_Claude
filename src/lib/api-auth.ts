import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: session.user, error: null };
}

export function isManager(role: string) {
  return role === "PROJECT_MANAGER" || role === "CEO" || role === "ADMIN";
}

// Roles that can execute production work themselves: start/hold/query/complete tasks,
// self-assign, log breaks. Per the new workflow, PM and Lead have the same execution
// access as Ops (in addition to their management abilities).
export function canExecuteTasks(role: string) {
  return role === "OPS" || role === "PRODUCTION_LEAD" || role === "PROJECT_MANAGER" || role === "CEO" || role === "ADMIN";
}

export function isClient(role: string) {
  return role === "CLIENT";
}
