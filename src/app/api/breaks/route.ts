import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { BREAK_CAP_MINUTES } from "@/lib/clock";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// List today's breaks for the current user.
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const date = startOfDay(new Date());
  const breaks = await prisma.breakLog.findMany({
    where: { userId: user!.id, date },
    orderBy: { startAt: "asc" },
  });
  const usedMinutes = breaks.reduce((sum, b) => sum + b.minutes, 0);
  return NextResponse.json({ breaks, usedMinutes, capMinutes: BREAK_CAP_MINUTES });
}

// Log a break. Enforces a hard cap of BREAK_CAP_MINUTES (60) per user per day.
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const minutes = Number(body.minutes);
  if (!minutes || minutes <= 0) {
    return NextResponse.json({ error: "minutes must be a positive number" }, { status: 400 });
  }

  const date = startOfDay(new Date());
  const existing = await prisma.breakLog.findMany({ where: { userId: user!.id, date } });
  const usedMinutes = existing.reduce((sum, b) => sum + b.minutes, 0);

  if (usedMinutes + minutes > BREAK_CAP_MINUTES) {
    return NextResponse.json(
      { error: `Break cap reached: ${usedMinutes}/${BREAK_CAP_MINUTES} min already used today.` },
      { status: 409 }
    );
  }

  const now = new Date();
  const breakLog = await prisma.breakLog.create({
    data: {
      userId: user!.id,
      date,
      startAt: now,
      endAt: new Date(now.getTime() + minutes * 60000),
      minutes,
    },
  });

  return NextResponse.json(breakLog, { status: 201 });
}
