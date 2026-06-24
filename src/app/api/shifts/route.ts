import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { DEFAULT_SHIFTS } from "@/lib/capacity";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  let shifts = await prisma.shift.findMany();
  if (shifts.length === 0) {
    await prisma.shift.createMany({
      data: DEFAULT_SHIFTS.map((s) => ({ ...s, isDefault: s.code === "GEN" })),
    });
    shifts = await prisma.shift.findMany();
  }
  return NextResponse.json(shifts);
}

// Edit a shift's time window (e.g. change GEN's default hours). PM/Lead/Admin/CEO only.
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD"].includes(user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { code, startTime, endTime, breakMins } = body;
  const shift = await prisma.shift.update({
    where: { code },
    data: { startTime, endTime, breakMins },
  });
  return NextResponse.json(shift);
}
