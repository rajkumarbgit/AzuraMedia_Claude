import { prisma } from "@/lib/prisma";

export async function addTimelineEvent(params: {
  jobId: string;
  type: string;
  description: string;
  version: number;
  actorId?: string | null;
  meta?: any;
}) {
  return prisma.timelineEvent.create({
    data: {
      jobId: params.jobId,
      type: params.type,
      description: params.description,
      version: params.version,
      actorId: params.actorId ?? null,
      meta: params.meta ?? undefined,
    },
  });
}

export function genJobNoSuffix() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}
