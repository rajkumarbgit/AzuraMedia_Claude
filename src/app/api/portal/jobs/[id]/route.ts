import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

// Same roadmap data as the internal job detail route, but locked to the client(s) the viewer
// may see: CLIENT → their own client; ONSITE_MANAGER → their tagged clients; CEO → any client.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const role = user!.role;
  let allowedClientIds: string[] | null = null; // null = no restriction (CEO)
  if (role === "CLIENT") {
    if (!user!.clientId) return NextResponse.json({ error: "Client access only" }, { status: 403 });
    allowedClientIds = [user!.clientId];
  } else if (role === "ONSITE_MANAGER") {
    const tagged = await prisma.managedClient.findMany({ where: { userId: user!.id }, select: { clientId: true } });
    allowedClientIds = tagged.map((t) => t.clientId);
  } else if (role !== "CEO") {
    return NextResponse.json({ error: "Client access only" }, { status: 403 });
  }

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true } },
      mandates: { orderBy: { createdAt: "asc" } },
      approvals: {
        include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      timelineEvents: {
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        include: {
          lead: { select: { id: true, name: true, role: true } },
          assignments: {
            include: {
              user: { select: { id: true, name: true, role: true } },
              timeLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
            },
            orderBy: { date: "asc" },
          },
          comments: { include: { author: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
          eodComments: { include: { user: { select: { name: true, role: true } } }, orderBy: { date: "asc" } },
        },
      },
      comments: {
        where: { taskId: null },
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!job || (allowedClientIds && !allowedClientIds.includes(job.clientId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}
