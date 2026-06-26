import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

// PM/Lead (and CEO/Admin) commentary on a job — typically added once a task or the whole job
// is completed. Shown on the job roadmap timeline alongside who-worked/hours/EOD comments.
const COMMENT_ROLES = ["PROJECT_MANAGER", "PRODUCTION_LEAD", "CEO", "ADMIN"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!COMMENT_ROLES.includes(user!.role)) {
    return NextResponse.json({ error: "Only PM/Lead can add job comments" }, { status: 403 });
  }

  const body = await req.json();
  const { comment, taskId } = body as { comment: string; taskId?: string };
  if (!comment?.trim()) return NextResponse.json({ error: "Comment text required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const jobComment = await prisma.jobComment.create({
    data: { jobId: job.id, taskId: taskId || null, authorId: user!.id, comment: comment.trim() },
    include: { author: { select: { name: true, role: true } }, task: { select: { name: true, taskNo: true } } },
  });

  await addTimelineEvent({
    jobId: job.id,
    type: "JOB_COMMENT",
    description: `${user!.name} commented${jobComment.task ? ` on ${jobComment.task.taskNo}` : ""}: "${comment.trim()}"`,
    version: job.version,
    actorId: user!.id,
    meta: { commentId: jobComment.id, taskId: taskId || null },
  });

  return NextResponse.json(jobComment, { status: 201 });
}
