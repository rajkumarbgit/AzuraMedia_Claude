import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { DEFAULT_SHIFTS, shiftCapacityHours } from "@/lib/capacity";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(today + "T00:00:00.000Z");
  const dayEnd = new Date(today + "T23:59:59.999Z");

  if (user!.role === "PROJECT_MANAGER") {
    const [myJobs, pendingApprovals] = await Promise.all([
      prisma.job.findMany({
        where: { createdById: user!.id },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.approvalRequest.findMany({
        where: { status: "PENDING", job: { createdById: user!.id } },
        include: { job: { select: { jobNo: true } }, requestedBy: { select: { name: true } } },
      }),
    ]);
    return NextResponse.json({ role: "PROJECT_MANAGER", myJobs, pendingApprovals });
  }

  if (user!.role === "PRODUCTION_LEAD") {
    const [myTasks, teamLeaves] = await Promise.all([
      prisma.task.findMany({
        where: { leadId: user!.id },
        include: { job: { select: { jobNo: true, title: true } } },
        orderBy: { startDate: "asc" },
        take: 15,
      }),
      prisma.leave.findMany({ where: { date: { gte: dayStart, lte: dayEnd } }, include: { user: { select: { name: true } } } }),
    ]);
    return NextResponse.json({ role: "PRODUCTION_LEAD", myTasks, teamLeaves });
  }

  if (user!.role === "OPS") {
    const [myAssignmentsToday, myUpcoming, leaveToday] = await Promise.all([
      prisma.taskAssignment.findMany({
        where: { userId: user!.id, date: { gte: dayStart, lte: dayEnd } },
        include: { task: { select: { taskNo: true, name: true, job: { select: { jobNo: true } } } } },
      }),
      prisma.taskAssignment.findMany({
        where: { userId: user!.id, date: { gt: dayEnd } },
        include: { task: { select: { taskNo: true, name: true } } },
        orderBy: { date: "asc" },
        take: 10,
      }),
      prisma.leave.findUnique({ where: { userId_date: { userId: user!.id, date: dayStart } } }),
    ]);
    const dbUser = await prisma.user.findUnique({ where: { id: user!.id } });
    const shiftDef = DEFAULT_SHIFTS.find((s) => s.code === (dbUser?.defaultShift ?? "GEN"))!;
    const capacityHours = shiftCapacityHours(shiftDef);
    const bookedHours = myAssignmentsToday.reduce((s, a) => s + a.hoursBooked, 0);
    return NextResponse.json({
      role: "OPS",
      onLeaveToday: !!leaveToday,
      capacityHours,
      bookedHours,
      remainingHours: Math.max(0, capacityHours - bookedHours),
      myAssignmentsToday,
      myUpcoming,
    });
  }

  return NextResponse.json({ role: user!.role });
}
