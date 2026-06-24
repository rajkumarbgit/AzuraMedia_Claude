import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { PAGE_DEFS } from "@/lib/permissions";

const TOGGLEABLE_ROLES = ["ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD", "OPS"];

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN"].includes(user!.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let pages = await prisma.page.findMany();
  if (pages.length === 0) {
    await prisma.page.createMany({ data: PAGE_DEFS });
    pages = await prisma.page.findMany();
  }

  const perms = await prisma.rolePagePermission.findMany();
  const matrix = TOGGLEABLE_ROLES.map((role) => ({
    role,
    pages: pages.map((p) => ({
      pageId: p.id,
      pageKey: p.key,
      label: p.label,
      canAccess: !!perms.find((perm) => perm.role === role && perm.pageId === p.id)?.canAccess,
    })),
  }));

  return NextResponse.json({ pages, matrix });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!["CEO", "ADMIN"].includes(user!.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { role, pageId, canAccess } = await req.json();
  if (!TOGGLEABLE_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const perm = await prisma.rolePagePermission.upsert({
    where: { role_pageId: { role, pageId } },
    update: { canAccess },
    create: { role, pageId, canAccess },
  });
  return NextResponse.json(perm);
}
