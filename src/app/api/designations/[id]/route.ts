import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN"].includes(user!.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.designation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
