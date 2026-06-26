import { prisma } from "@/lib/prisma";

// Where a person's shift starts, as a Date on the given day, falling back to 09:00 if the
// shift code isn't found (shouldn't normally happen — ShiftCode is a closed enum seeded with rows).
async function shiftStartOn(shiftCode: string, day: Date): Promise<Date> {
  const shift = await prisma.shift.findUnique({ where: { code: shiftCode as any } });
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  if (shift?.startTime) {
    const [h, m] = shift.startTime.split(":").map(Number);
    d.setHours(h, m || 0, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

// Decide where a brand-new TaskAssignment should land on the user's Live Job Timeline for `date`:
// - If they already have other bookings that day, append it right after the latest one ends.
// - If they have nothing booked yet that day, drop it at "now" (current booking time) when the
//   date is today, or at their shift's start time when booking a future/past day.
export async function computeAutoScheduledStart(userId: string, date: Date, shiftCode: string): Promise<Date> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const existing = await prisma.taskAssignment.findMany({
    where: { userId, date: { gte: dayStart, lt: dayEnd } },
    select: { shift: true, hoursBooked: true, scheduledStart: true },
  });

  if (existing.length > 0) {
    let latestEnd: Date | null = null;
    for (const a of existing) {
      const start = a.scheduledStart ?? (await shiftStartOn(a.shift, dayStart));
      const end = new Date(start.getTime() + (a.hoursBooked || 0) * 60 * 60 * 1000);
      if (!latestEnd || end > latestEnd) latestEnd = end;
    }
    return latestEnd!;
  }

  const isToday = dayStart.toDateString() === new Date().toDateString();
  if (isToday) return new Date();
  return shiftStartOn(shiftCode, dayStart);
}
