import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

// Adding an extra mandate always increases (or may increase) the client's project cost, so it
// is always routed to the client for approval — regardless of whether a PM/Lead/CEO or an Ops
// person is the one requesting it. PM/Lead can still assign work against the job while this is
// pending; Ops just can't *start* the job until the client approves (enforced in the clock API).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const { name, description, comment, addedCost } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Mandate name required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const cost = addedCost !== undefined && addedCost !== null && addedCost !== "" ? Number(addedCost) : 0;
  const newTotal = Number(job.clientBudget) + cost;

  const approval = await prisma.approvalRequest.create({
    data: {
      jobId: job.id,
      type: "MANDATE_ADD",
      comment,
      payload: { name: name.trim(), description, addedCost: cost },
      costImpact: { addedCost: cost, currentBudget: Number(job.clientBudget), newTotal, currency: job.currency },
      requestedById: user!.id,
    },
  });

  await addTimelineEvent({
    jobId: job.id,
    type: "MANDATE_ADD_REQUESTED",
    description: `${user!.name} requested new mandate "${name.trim()}"${cost ? ` (+${job.currency} ${cost.toFixed(2)})` : ""}${comment ? ` — "${comment}"` : ""} — awaiting client approval`,
    version: job.version,
    actorId: user!.id,
    meta: { approvalId: approval.id },
  });

  return NextResponse.json({ approval, autoApproved: false }, { status: 201 });
}
