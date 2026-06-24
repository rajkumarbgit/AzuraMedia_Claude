import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

// Request (or directly add, if manager) a new mandate on a job.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const { name, description, comment } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Mandate name required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (isManager(user!.role)) {
    const mandate = await prisma.mandate.create({
      data: { jobId: job.id, name: name.trim(), description, status: "ACTIVE" },
    });
    const updated = await prisma.job.update({ where: { id: job.id }, data: { version: { increment: 1 } } });
    await addTimelineEvent({
      jobId: job.id,
      type: "MANDATE_ADDED",
      description: `Mandate "${mandate.name}" added by ${user!.name}`,
      version: updated.version,
      actorId: user!.id,
    });
    return NextResponse.json({ mandate, autoApproved: true }, { status: 201 });
  }

  // Production team: needs PM approval.
  const approval = await prisma.approvalRequest.create({
    data: {
      jobId: job.id,
      type: "MANDATE_ADD",
      comment,
      payload: { name: name.trim(), description },
      requestedById: user!.id,
    },
  });

  await addTimelineEvent({
    jobId: job.id,
    type: "MANDATE_ADD_REQUESTED",
    description: `${user!.name} requested new mandate "${name.trim()}"${comment ? ` — "${comment}"` : ""}`,
    version: job.version,
    actorId: user!.id,
    meta: { approvalId: approval.id },
  });

  return NextResponse.json({ approval, autoApproved: false }, { status: 201 });
}
