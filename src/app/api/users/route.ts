import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { isOnline } from "@/lib/clock";

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const users = await prisma.user.findMany({
    where: { ...(role ? { role: role as any } : {}), isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      defaultShift: true,
      lastSeenAt: true,
      designation: { select: { name: true } },
      managedClients: { select: { clientId: true, client: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users.map((u) => ({ ...u, online: isOnline(u.lastSeenAt) })));
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN"].includes(user!.role)) {
    return NextResponse.json({ error: "Only CEO/Admin can add users" }, { status: 403 });
  }
  const body = await req.json();
  const { name, email, password, role, designationId, defaultShift, managedClientIds } = body;
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      designationId: designationId || null,
      defaultShift: defaultShift || "GEN",
      ...(role === "ONSITE_MANAGER" && Array.isArray(managedClientIds) && managedClientIds.length > 0
        ? { managedClients: { create: managedClientIds.map((clientId: string) => ({ clientId })) } }
        : {}),
    },
  });
  return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }, { status: 201 });
}
