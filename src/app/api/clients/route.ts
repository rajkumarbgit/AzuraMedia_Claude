import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(clients);
}

// Adding a client lets Admin/CEO set the short code used for that client's auto job numbering
// (e.g. "NIM" -> NIM-0001, NIM-0002, ...), and optionally create the client's portal login in
// the same step.
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.role !== "CEO" && user!.role !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin/CEO can add client accounts" }, { status: 403 });
  }
  const body = await req.json();
  const { name, code, contactName, contactEmail, currency, loginEmail, loginPassword } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Client name required" }, { status: 400 });
  if (!code?.trim()) return NextResponse.json({ error: "Client code required" }, { status: 400 });

  const normalizedCode = code.trim().toUpperCase();
  const existingCode = await prisma.client.findUnique({ where: { code: normalizedCode } });
  if (existingCode) return NextResponse.json({ error: "Client code already in use" }, { status: 409 });

  const client = await prisma.client.create({
    data: { name: name.trim(), code: normalizedCode, contactName, contactEmail, currency: currency ?? "USD" },
  });

  let createdLogin: { id: string; email: string } | null = null;
  if (loginEmail && loginPassword) {
    const existingUser = await prisma.user.findUnique({ where: { email: loginEmail.toLowerCase().trim() } });
    if (existingUser) {
      return NextResponse.json({ client, loginError: "A login with that email already exists — client saved without a login." }, { status: 201 });
    }
    const passwordHash = await bcrypt.hash(loginPassword, 10);
    const loginUser = await prisma.user.create({
      data: {
        name: contactName || name.trim(),
        email: loginEmail.toLowerCase().trim(),
        passwordHash,
        role: "CLIENT",
        clientId: client.id,
      },
    });
    createdLogin = { id: loginUser.id, email: loginUser.email };
  }

  return NextResponse.json({ client, createdLogin }, { status: 201 });
}
