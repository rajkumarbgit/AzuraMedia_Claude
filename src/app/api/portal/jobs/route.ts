import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

// The client portal's job list. Scoped by role:
// - CLIENT: only their own client's jobs.
// - ONSITE_MANAGER: only the client(s) they're tagged to (see ManagedClient).
// - CEO: every client by default, optionally narrowed with ?clientId=.
export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const role = user!.role;
  const clientIdParam = new URL(req.url).searchParams.get("clientId");

  // allowedClientIds === null means "no restriction" (CEO with no filter applied).
  let allowedClientIds: string[] | null = null;

  if (role === "CLIENT") {
    if (!user!.clientId) return NextResponse.json({ error: "Client access only" }, { status: 403 });
    allowedClientIds = [user!.clientId];
  } else if (role === "ONSITE_MANAGER") {
    const tagged = await prisma.managedClient.findMany({ where: { userId: user!.id }, select: { clientId: true } });
    allowedClientIds = tagged.map((t) => t.clientId);
    if (allowedClientIds.length === 0) return NextResponse.json([]);
  } else if (role === "CEO") {
    allowedClientIds = null;
  } else {
    return NextResponse.json({ error: "Client access only" }, { status: 403 });
  }

  let where: any = {};
  if (clientIdParam) {
    if (allowedClientIds && !allowedClientIds.includes(clientIdParam)) {
      return NextResponse.json({ error: "Not authorized for this client" }, { status: 403 });
    }
    where = { clientId: clientIdParam };
  } else if (allowedClientIds) {
    where = { clientId: { in: allowedClientIds } };
  }

  const jobs = await prisma.job.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      mandates: true,
      _count: { select: { tasks: true, approvals: true } },
      approvals: { where: { status: "PENDING" }, select: { id: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}
