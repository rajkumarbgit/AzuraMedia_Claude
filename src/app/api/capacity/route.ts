import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { DEFAULT_SHIFTS, shiftCapacityHours } from "@/lib/capacity";

export async function GET(req: NextRequest) {
  try {
    return await handleGet(req);
  } catch (e: any) {
    console.error("GET /api/capacity failed:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error loading capacity" }, { status: 500 });
  }
}

async function handleGet(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
  const date = new Date(dateStr);
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dateStr + "T23:59:59.999Z");

  let shifts = await prisma.shift.findMany();
  if (shifts.length === 0) {
    await prisma.shift.createMany({ data: DEFAULT_SHIFTS.map((s) => ({ ...s, isDefault: s.code === "GEN" })) });
    shifts = await prisma.shift.findMany();
  }
  const shiftMap = Object.fromEntries(shifts.map((s) => [s.code, s]));

  const people = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OPS", "PRODUCTION_LEAD"] } },
    select: { id: true, name: true, defaultShift: true, role: true },
  });

  const leaves = await prisma.leave.findMany({ where: { date: { gte: dayStart, lte: dayEnd } } });
  const leaveUserIds = new Set(leaves.map((l) => l.userId));

  const assignments = await prisma.taskAssignment.findMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
    include: { task: { select: { taskNo: true, name: true, job: { select: { jobNo: true } } } } },
  });

  const perPerson = people.map((p) => {
    const onLeave = leaveUserIds.has(p.id);
    const shiftDef = shiftMap[p.defaultShift] ?? shiftMap["GEN"];
    const capacityHours = onLeave ? 0 : shiftCapacityHours(shiftDef);
    const myAssignments = assignments.filter((a) => a.userId === p.id);
    const bookedHours = myAssignments.reduce((s, a) => s + a.hoursBooked, 0);
    return {
      userId: p.id,
      name: p.name,
      role: p.role,
      shift: p.defaultShift,
      onLeave,
      capacityHours: +capacityHours.toFixed(2),
      bookedHours: +bookedHours.toFixed(2),
      remainingHours: +Math.max(0, capacityHours - bookedHours).toFixed(2),
      bookings: myAssignments.map((a) => ({
        taskNo: a.task.taskNo,
        taskName: a.task.name,
        jobNo: a.task.job.jobNo,
        hours: a.hoursBooked,
        shift: a.shift,
      })),
    };
  });

  const totalCapacityHours = +perPerson.reduce((s, p) => s + p.capacityHours, 0).toFixed(2);
  const totalBookedHours = +perPerson.reduce((s, p) => s + p.bookedHours, 0).toFixed(2);
  const totalRemainingHours = +Math.max(0, totalCapacityHours - totalBookedHours).toFixed(2);

  return NextResponse.json({
    date: dateStr,
    totalCapacityHours,
    totalBookedHours,
    totalRemainingHours,
    onLeaveCount: leaveUserIds.size,
    perPerson,
  });
}
