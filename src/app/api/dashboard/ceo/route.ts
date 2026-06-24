import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN"].includes(user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobs = await prisma.job.findMany({
    include: {
      client: { select: { name: true } },
      createdBy: { select: { name: true } },
      tasks: { select: { id: true, estimatedHours: true, status: true } },
    },
  });

  const completed = jobs.filter((j) => j.status === "COMPLETED");
  const inProgress = jobs.filter((j) => j.status === "IN_PROGRESS");
  const onHold = jobs.filter((j) => j.status === "ON_HOLD");
  const cancelled = jobs.filter((j) => j.status === "CANCELLED");

  const totalEarning = completed.reduce((sum, j) => sum + Number(j.clientBudget), 0);
  const forecastEarning = [...inProgress, ...onHold, ...jobs.filter((j) => j.status === "DRAFT")].reduce(
    (sum, j) => sum + Number(j.clientBudget),
    0
  );

  const byStatus = [
    { status: "Completed", count: completed.length },
    { status: "In Progress", count: inProgress.length },
    { status: "On Hold", count: onHold.length },
    { status: "Draft", count: jobs.filter((j) => j.status === "DRAFT").length },
    { status: "Cancelled", count: cancelled.length },
  ];

  const pendingApprovals = await prisma.approvalRequest.count({ where: { status: "PENDING" } });

  const inProgressDetail = inProgress.map((j) => ({
    id: j.id,
    jobNo: j.jobNo,
    title: j.title,
    client: j.client?.name,
    pm: j.createdBy?.name,
    estimatedHours: j.estimatedHours,
    budget: Number(j.clientBudget),
    currency: j.currency,
  }));

  const byCurrency: Record<string, number> = {};
  for (const j of jobs) {
    byCurrency[j.currency] = (byCurrency[j.currency] ?? 0) + Number(j.clientBudget);
  }

  return NextResponse.json({
    totalJobs: jobs.length,
    completedCount: completed.length,
    inProgressCount: inProgress.length,
    pendingApprovals,
    totalEarning,
    forecastEarning,
    byStatus,
    byCurrency,
    inProgressDetail,
  });
}
