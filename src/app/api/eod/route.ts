import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const userId = searchParams.get("userId");
  const taskId = searchParams.get("taskId");
  const comments = await prisma.eodComment.findMany({
    where: {
      ...(date ? { date: new Date(date) } : {}),
      ...(userId ? { userId } : {}),
      ...(taskId ? { taskId } : {}),
    },
    include: { user: { select: { name: true } }, task: { select: { taskNo: true, name: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const body = await req.json();
  const { date, taskId, comment } = body;
  if (!date || !comment) return NextResponse.json({ error: "date and comment required" }, { status: 400 });

  const eod = await prisma.eodComment.upsert({
    where: { userId_date: { userId: user!.id, date: new Date(date) } },
    update: { comment, taskId: taskId || null },
    create: { userId: user!.id, taskId: taskId || null, date: new Date(date), comment },
  });
  return NextResponse.json(eod, { status: 201 });
}
