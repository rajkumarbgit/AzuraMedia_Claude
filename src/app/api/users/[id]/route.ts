import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN"].includes(user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const allowed = ["name", "role", "designationId", "defaultShift", "isActive"];
  const data: any = {};
  for (const key of allowed) if (key in body) data[key] = body[key];
  const updated = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, role: updated.role });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN"].includes(user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Soft delete: deactivate rather than hard-delete to preserve job/task history & FK integrity.
  await prisma.user.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
