import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireUser();
  if (error) return error;
  const assignment = await prisma.taskAssignment.findUnique({ where: { id: params.id } });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.taskAssignment.delete({ where: { id: params.id } });
  await prisma.task.update({ where: { id: assignment.taskId }, data: { version: { increment: 1 } } });
  return NextResponse.json({ ok: true });
}
