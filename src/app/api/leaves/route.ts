import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const leaves = await prisma.leave.findMany({
    where: {
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { user: { select: { id: true, name: true } }, markedBy: { select: { name: true } } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(leaves);
}

// Self can mark own leave. Lead/PM/CEO/Admin can mark for multiple people at once.
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const { userIds, date, reason } = body as { userIds: string[]; date: string; reason?: string };
  if (!date || !userIds?.length) {
    return NextResponse.json({ error: "date and userIds required" }, { status: 400 });
  }

  const canMarkOthers = ["CEO", "ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD"].includes(user!.role);
  const targetIds = canMarkOthers ? userIds : [user!.id];

  const results = await Promise.all(
    targetIds.map((uid) =>
      prisma.leave.upsert({
        where: { userId_date: { userId: uid, date: new Date(date) } },
        update: { reason, markedById: user!.id },
        create: { userId: uid, date: new Date(date), reason, markedById: user!.id },
      })
    )
  );

  return NextResponse.json(results, { status: 201 });
}
