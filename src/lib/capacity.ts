import { ShiftCode } from "@prisma/client";

export interface ShiftDef {
  code: ShiftCode;
  label: string;
  startTime: string;
  endTime: string;
  breakMins: number;
}

// Falls back to these if DB has no Shift rows yet (first run before seed).
export const DEFAULT_SHIFTS: ShiftDef[] = [
  { code: "APAC", label: "APAC", startTime: "06:00", endTime: "14:00", breakMins: 60 },
  { code: "EMEA", label: "EMEA", startTime: "14:00", endTime: "22:00", breakMins: 60 },
  { code: "AMER", label: "AMER", startTime: "22:00", endTime: "06:00", breakMins: 60 },
  { code: "GEN", label: "GEN (Default)", startTime: "09:00", endTime: "18:00", breakMins: 60 },
];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Effective working capacity for a shift in hours, excluding break. Handles overnight shifts (e.g. AMER). */
export function shiftCapacityHours(shift: { startTime: string; endTime: string; breakMins: number }) {
  let start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);
  if (end <= start) end += 24 * 60; // overnight wrap (AMER 22:00 -> 06:00)
  const totalMins = end - start - shift.breakMins;
  return Math.max(0, totalMins / 60);
}

export function remainingCapacity(totalCapacityHours: number, bookedHours: number) {
  return Math.max(0, +(totalCapacityHours - bookedHours).toFixed(2));
}
