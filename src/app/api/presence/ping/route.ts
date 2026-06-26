import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

// Lightweight heartbeat — called periodically from the client while the app is open.
// Drives the online/offline dot shown next to each user across the app.
export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;

  await prisma.user.update({ where: { id: user!.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
