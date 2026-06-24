import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const approvals = await prisma.approvalRequest.findMany({
    where: { status: status as any },
    include: {
      job: { select: { id: true, jobNo: true, title: true } },
      requestedBy: { select: { name: true, role: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(approvals);
}
