import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireUser();
  if (error) return error;
  await prisma.leave.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
