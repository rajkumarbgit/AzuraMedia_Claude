import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.role !== "CEO" && user!.role !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin/CEO can add client accounts" }, { status: 403 });
  }
  const body = await req.json();
  const { name, contactName, contactEmail, currency } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Client name required" }, { status: 400 });
  const client = await prisma.client.create({
    data: { name: name.trim(), contactName, contactEmail, currency: currency ?? "USD" },
  });
  return NextResponse.json(client, { status: 201 });
}
