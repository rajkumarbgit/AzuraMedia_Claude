"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Avatar, Badge, Card, Input, Modal, Select, StatCard, Textarea } from "@/components/ui";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Mirrors src/lib/clock.ts's presenceStatus thresholds (can't import that module directly here —
// it pulls in the Prisma client, which shouldn't ship to the browser bundle). onLeave (today's
// Leave record) takes priority over the heartbeat and renders as a 4th "out of office" state.
function presenceOf(lastSeenAt?: string | null, onLeave?: boolean): "online" | "away" | "offline" | "leave" {
  if (onLeave) return "leave";
  if (!lastSeenAt) return "offline";
  const elapsed = Date.now() - new Date(lastSeenAt).getTime();
  if (elapsed < 2 * 60 * 1000) return "online";
  if (elapsed < 10 * 60 * 1000) return "away";
  return "offline";
}

const WORK_STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: "gray",
  IN_PROGRESS: "blue",
  ON_HOLD: "amber",
  QUERY: "amber",
  COMPLETED: "green",
};

const CLOCK_ACTIONS: { action: string; label: string; show: (ws: string) => boolean }[] = [
  { action: "START", label: "Start", show: (ws) => ws === "NOT_STARTED" },
  { action: "RESUME", label: "Resume", show: (ws) => ws === "ON_HOLD" || ws === "QUERY" },
  { action: "HOLD", label: "Hold", show: (ws) => ws === "IN_PROGRESS" },
  { action: "QUERY", label: "Query", show: (ws) => ws === "IN_PROGRESS" },
  { action: "COMPLETE", label: "Complete", show: (ws) => ws === "IN_PROGRESS" || ws === "ON_HOLD" || ws === "QUERY" },
];

export default function ProductionTimelinePage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isLeadOrUp = ["CEO", "ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD"].includes(role ?? "");
  const isExec = ["OPS", "PRODUCTION_LEAD", "PROJECT_MANAGER", "CEO", "ADMIN"].includes(role ?? "");

  const [date, setDate] = useState(todayStr());
  const [capacity, setCapacity] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [clockBusy, setClockBusy] = useState<string | null>(null);
  const [timelineMode, setTimelineMode] = useState<"shift" | "24hr">("shift");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [breakOpen, setBreakOpen] = useState(false);
  const [breakStatus, setBreakStatus] = useState<any>(null);
  const [breakMinutes, setBreakMinutes] = useState("15");
  const [breakError, setBreakError] = useState("");

  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [eodOpen, setEodOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);

  const [taskForm, setTaskForm] = useState({ jobId: "", name: "", leadId: "", estimatedHours: "", startDate: date, endDate: date });
  const [assignForm, setAssignForm] = useState({ userId: "", shift: "GEN", date, hoursBooked: "8" });
  const [leaveForm, setLeaveForm] = useState<{ userIds: string[]; reason: string }>({ userIds: [], reason: "" });
  const [eodForm, setEodForm] = useState({ taskId: "", comment: "" });

  const loadCapacity = useCallback(async () => {
    const res = await fetch(`/api/capacity?date=${date}`);
    setCapacity(await res.json());
  }, [date]);

  const loadTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?q=${encodeURIComponent(q)}`);
    setTasks(await res.json());
  }, [q]);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);

  useEffect(() => {
    const t = setTimeout(loadTasks, 250);
    return () => clearTimeout(t);
  }, [loadTasks]);

  useEffect(() => {
    // Refresh periodically so online/offline dots and the live job timeline don't go stale.
    const t = setInterval(loadTasks, 20000);
    return () => clearInterval(t);
  }, [loadTasks]);

  useEffect(() => {
    loadBreakStatus();
  }, []);

  const loadPeople = useCallback(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setPeople);
  }, []);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then(setJobs);
    loadPeople();
    fetch("/api/shifts")
      .then((r) => r.json())
      .then(setShifts);
  }, [loadPeople]);

  useEffect(() => {
    // Keep the row online/offline dots fresh too.
    const t = setInterval(loadPeople, 20000);
    return () => clearInterval(t);
  }, [loadPeople]);

  async function createTask() {
    setBusy(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...taskForm, estimatedHours: parseFloat(taskForm.estimatedHours || "0") }),
    });
    setBusy(false);
    setNewTaskOpen(false);
    setTaskForm({ jobId: "", name: "", leadId: "", estimatedHours: "", startDate: date, endDate: date });
    loadTasks();
  }

  async function assignOps() {
    if (!assignOpen) return;
    setBusy(true);
    await fetch(`/api/tasks/${assignOpen}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...assignForm, hoursBooked: parseFloat(assignForm.hoursBooked) }),
    });
    setBusy(false);
    setAssignOpen(null);
    loadTasks();
    loadCapacity();
  }

  async function markLeave() {
    setBusy(true);
    await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: leaveForm.userIds, date, reason: leaveForm.reason }),
    });
    setBusy(false);
    setLeaveOpen(false);
    setLeaveForm({ userIds: [], reason: "" });
    loadCapacity();
  }

  async function submitEod() {
    setBusy(true);
    await fetch("/api/eod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, taskId: eodForm.taskId || null, comment: eodForm.comment }),
    });
    setBusy(false);
    setEodOpen(false);
    setEodForm({ taskId: "", comment: "" });
  }

  async function saveShift(code: string, startTime: string, endTime: string, breakMins: number) {
    await fetch("/api/shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, startTime, endTime, breakMins }),
    });
    fetch("/api/shifts")
      .then((r) => r.json())
      .then(setShifts);
    loadCapacity();
  }

  async function doClock(assignmentId: string, action: string) {
    setClockBusy(assignmentId);
    let note: string | undefined;
    if (action === "QUERY") note = window.prompt("Query — what's blocking you?") ?? undefined;
    const res = await fetch(`/api/assignments/${assignmentId}/clock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    setClockBusy(null);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to update");
      return;
    }
    loadTasks();
    loadCapacity();
  }

  async function assignSelf(taskId: string) {
    if (!session?.user?.id) return;
    setBusy(true);
    const res = await fetch(`/api/tasks/${taskId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, shift: session.user.defaultShift ?? "GEN", date, hoursBooked: 8 }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to assign yourself");
      return;
    }
    loadTasks();
    loadCapacity();
  }

  async function rescheduleAssignment(assignmentId: string, scheduledStartIso: string, userId?: string) {
    const res = await fetch(`/api/assignments/${assignmentId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledStart: scheduledStartIso, ...(userId ? { userId } : {}) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to move job");
      return;
    }
    loadTasks();
  }

  async function loadBreakStatus() {
    const res = await fetch("/api/breaks");
    setBreakStatus(await res.json());
  }

  async function submitBreak() {
    setBreakError("");
    setBusy(true);
    const res = await fetch("/api/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: parseInt(breakMinutes || "0") }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setBreakError(data.error ?? "Failed to log break");
      return;
    }
    loadBreakStatus();
  }

  const opsAndLeads = people.filter((p) => ["OPS", "PRODUCTION_LEAD"].includes(p.role));

  // Who's on leave / out of office for the selected date — drives the 4th "leave" presence state.
  const leaveUserIds = new Set<string>((capacity?.perPerson ?? []).filter((p: any) => p.onLeave).map((p: any) => p.userId));

  // Flatten today's assignments across all loaded tasks for the live cross-user timeline.
  const todaysAssignments = tasks.flatMap((t) =>
    (t.assignments ?? [])
      .filter((a: any) => new Date(a.date).toISOString().slice(0, 10) === date)
      .map((a: any) => ({ ...a, taskName: t.name, taskNo: t.taskNo, jobNo: t.job?.jobNo, taskLeadId: t.lead?.id }))
  );

  // Hour-column Gantt bounds. "Shift Hours" spans the earliest shift start to the latest
  // shift end; "Full 24 Hrs" always spans midnight to midnight.
  const shiftBounds = shifts.length
    ? shifts.reduce(
        (acc: { start: number; end: number }, s: any) => {
          const sh = parseInt((s.startTime || "06:00").split(":")[0], 10);
          const eh = parseInt((s.endTime || "22:00").split(":")[0], 10);
          return { start: Math.min(acc.start, sh), end: Math.max(acc.end, eh || sh + 1) };
        },
        { start: 23, end: 1 }
      )
    : { start: 6, end: 22 };
  const axisStart = timelineMode === "24hr" ? 0 : shiftBounds.start;
  const axisEnd = timelineMode === "24hr" ? 24 : Math.max(shiftBounds.end, axisStart + 1);
  const hourMarks = Array.from({ length: axisEnd - axisStart + 1 }, (_, i) => axisStart + i);
  const HOUR_PX = 64;
  const LANE_PX = 52;
  const ROW_LABEL_PX = 160;

  function effectiveStartHour(a: any): number {
    if (a.scheduledStart) {
      const d = new Date(a.scheduledStart);
      return d.getHours() + d.getMinutes() / 60;
    }
    const sh = shifts.find((s: any) => s.code === a.shift);
    if (sh?.startTime) {
      const [h, m] = sh.startTime.split(":").map((n: string) => parseInt(n, 10));
      return h + (m || 0) / 60;
    }
    return axisStart;
  }

  // Rows = every ops/lead person, plus anyone else (e.g. a PM or CEO) who's actually booked today.
  const timelineUserIds = Array.from(
    new Set<string>([...opsAndLeads.map((p: any) => p.id), ...todaysAssignments.map((a: any) => a.userId)])
  );
  const timelineUsers = timelineUserIds
    .map((id) => people.find((p: any) => p.id === id) || todaysAssignments.find((a: any) => a.userId === id)?.user)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));

  function packLanes(rowAssignments: any[]) {
    const withTimes = rowAssignments
      .map((a) => {
        const start = effectiveStartHour(a);
        const end = start + Math.max(0.5, a.hoursBooked || 1);
        return { a, start, end };
      })
      .sort((x, y) => x.start - y.start);
    const lanes: number[] = [];
    const placed = withTimes.map((item) => {
      let lane = lanes.findIndex((end) => end <= item.start + 0.01);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(item.end);
      } else {
        lanes[lane] = item.end;
      }
      return { ...item, lane };
    });
    return { placed, laneCount: Math.max(1, lanes.length) };
  }

  const nowHour = (() => {
    const n = new Date();
    return n.getHours() + n.getMinutes() / 60;
  })();
  const showNowLine = date === todayStr() && nowHour >= axisStart && nowHour <= axisEnd;

  function handleDropOnRow(e: any, targetUserId: string) {
    e.preventDefault();
    const assignmentId = e.dataTransfer.getData("text/plain");
    if (!assignmentId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let hour = axisStart + x / HOUR_PX;
    hour = Math.round(hour * 4) / 4;
    hour = Math.max(axisStart, Math.min(axisEnd - 0.25, hour));
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const start = new Date(`${date}T00:00:00`);
    start.setHours(h, m, 0, 0);
    rescheduleAssignment(assignmentId, start.toISOString(), targetUserId);
  }

  const selectedAssignment = todaysAssignments.find((a: any) => a.id === selectedAssignmentId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Production Timeline</h1>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          {isLeadOrUp && (
            <button className="btn-primary" onClick={() => setNewTaskOpen(true)}>
              + Book Task
            </button>
          )}
          <button className="btn-secondary" onClick={() => setLeaveOpen(true)}>
            Mark Leave
          </button>
          <button className="btn-secondary" onClick={() => setEodOpen(true)}>
            EOD Comment
          </button>
          <button className="btn-secondary" onClick={() => setBreakOpen(true)}>
            Take Break
          </button>
          {isLeadOrUp && (
            <button className="btn-secondary" onClick={() => setShiftOpen(true)}>
              Shifts
            </button>
          )}
        </div>
      </div>

      {capacity && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Capacity (excl. break)" value={`${capacity.totalCapacityHours}h`} />
          <StatCard label="Total Booked" value={`${capacity.totalBookedHours}h`} accent="blue" />
          <StatCard label="Total Remaining" value={`${capacity.totalRemainingHours}h`} accent="green" />
          <StatCard label="On Leave" value={capacity.onLeaveCount} accent="amber" />
        </div>
      )}

      {capacity && (
        <Card>
          <h3 className="font-semibold mb-3">Individual Remaining Capacity — {date}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
                <tr>
                  <th className="p-2">Person</th>
                  <th className="p-2">Shift</th>
                  <th className="p-2">Capacity</th>
                  <th className="p-2">Booked</th>
                  <th className="p-2">Remaining</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {capacity.perPerson.map((p: any) => (
                  <tr key={p.userId} className="border-b border-[rgb(var(--border))] last:border-0">
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2">
                      <Badge color="blue">{p.shift}</Badge>
                    </td>
                    <td className="p-2">{p.capacityHours}h</td>
                    <td className="p-2">{p.bookedHours}h</td>
                    <td className="p-2 font-semibold">{p.remainingHours}h</td>
                    <td className="p-2">{p.onLeave ? <Badge color="red">On Leave</Badge> : <Badge color="green">Available</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">Live Job Timeline — {date}</h3>
            <p className="text-xs text-[rgb(var(--muted))] mt-0.5">
              Drag a box to reschedule it, or drop it on another row to reassign. Click a box for actions.
            </p>
          </div>
          <div className="flex gap-1.5 rounded-lg bg-black/5 dark:bg-white/5 p-1">
            <button
              onClick={() => setTimelineMode("shift")}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
                timelineMode === "shift" ? "bg-brand-500 text-white" : "text-[rgb(var(--muted))]"
              }`}
            >
              Shift Hours
            </button>
            <button
              onClick={() => setTimelineMode("24hr")}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
                timelineMode === "24hr" ? "bg-brand-500 text-white" : "text-[rgb(var(--muted))]"
              }`}
            >
              Full 24 Hrs
            </button>
          </div>
        </div>

        {timelineUsers.length === 0 ? (
          <p className="text-center text-sm text-[rgb(var(--muted))] py-6">No ops/lead users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: ROW_LABEL_PX + (axisEnd - axisStart) * HOUR_PX }}>
              {/* Hour header */}
              <div className="flex">
                <div style={{ width: ROW_LABEL_PX }} className="shrink-0" />
                <div className="flex">
                  {hourMarks.slice(0, -1).map((h) => {
                    const hh = h % 24;
                    const label = hh === 0 ? "12 AM" : hh < 12 ? `${hh} AM` : hh === 12 ? "12 PM" : `${hh - 12} PM`;
                    return (
                      <div
                        key={h}
                        className="shrink-0 text-[10px] font-semibold text-[rgb(var(--muted))] border-l border-[rgb(var(--border))] pl-1 pb-1"
                        style={{ width: HOUR_PX }}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative space-y-1">
                {showNowLine && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-danger-500 z-10 pointer-events-none"
                    style={{ left: ROW_LABEL_PX + (nowHour - axisStart) * HOUR_PX }}
                    title="Now"
                  />
                )}
                {timelineUsers.map((u: any) => {
                  const rowAssignments = todaysAssignments.filter((a: any) => a.userId === u.id);
                  const { placed, laneCount } = packLanes(rowAssignments);
                  const rowHeight = laneCount * LANE_PX + 8;
                  return (
                    <div key={u.id} className="flex items-stretch">
                      <div style={{ width: ROW_LABEL_PX }} className="shrink-0 flex items-center gap-2 pr-2">
                        <Avatar name={u.name ?? "?"} size={26} presence={presenceOf(u.lastSeenAt, leaveUserIds.has(u.id))} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{u.name}</div>
                          <div className="text-[10px] text-[rgb(var(--muted))] truncate">{(u.role ?? "").replace("_", " ")}</div>
                        </div>
                      </div>
                      <div
                        className="relative flex-1 border-l border-[rgb(var(--border))] rounded-r-lg bg-black/[0.02] dark:bg-white/[0.02]"
                        style={{ height: rowHeight, width: (axisEnd - axisStart) * HOUR_PX }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnRow(e, u.id)}
                      >
                        {hourMarks.slice(1, -1).map((h) => (
                          <div
                            key={h}
                            className="absolute top-0 bottom-0 border-l border-[rgb(var(--border))]/50"
                            style={{ left: (h - axisStart) * HOUR_PX }}
                          />
                        ))}
                        {placed.length === 0 && (
                          <span className="absolute inset-0 flex items-center text-[11px] text-[rgb(var(--muted))] pl-2">
                            Nothing booked
                          </span>
                        )}
                        {placed.map(({ a, start, end, lane }: any) => {
                          const left = Math.max(0, (start - axisStart) * HOUR_PX);
                          const width = Math.max(36, (end - start) * HOUR_PX);
                          const canDrag = a.userId === session?.user?.id || a.taskLeadId === session?.user?.id || isLeadOrUp;
                          const bg =
                            a.workStatus === "COMPLETED"
                              ? "bg-success-500"
                              : a.workStatus === "IN_PROGRESS"
                              ? "bg-brand-500"
                              : a.workStatus === "ON_HOLD" || a.workStatus === "QUERY"
                              ? "bg-warning-500"
                              : "bg-[rgb(var(--muted))]";
                          return (
                            <div
                              key={a.id}
                              draggable={canDrag}
                              onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                              onClick={() => setSelectedAssignmentId(a.id)}
                              title={`${a.jobNo} · ${a.taskName} · ${a.workStatus.replace("_", " ")}`}
                              className={`absolute rounded-lg px-2 py-1 text-[11px] font-semibold text-white shadow-sm overflow-hidden cursor-pointer ${
                                canDrag ? "active:cursor-grabbing" : ""
                              } ${bg} ${selectedAssignmentId === a.id ? "ring-2 ring-offset-1 ring-brand-600" : ""}`}
                              style={{ left, width, top: lane * LANE_PX + 4, height: LANE_PX - 8 }}
                            >
                              <div className="truncate">{a.taskName}</div>
                              <div className="truncate text-[10px] opacity-80">{a.jobNo}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {selectedAssignment && (
          <div className="mt-4 flex items-center gap-3 flex-wrap rounded-xl border border-[rgb(var(--border))] px-3 py-2.5 bg-black/[0.02] dark:bg-white/[0.02]">
            <Avatar
              name={selectedAssignment.user?.name ?? "?"}
              size={26}
              presence={presenceOf(
                people.find((p) => p.id === selectedAssignment.user?.id)?.lastSeenAt,
                leaveUserIds.has(selectedAssignment.userId)
              )}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {selectedAssignment.taskName} <span className="text-[rgb(var(--muted))] font-normal">— {selectedAssignment.jobNo}</span>
              </div>
              <div className="text-xs text-[rgb(var(--muted))]">
                {selectedAssignment.user?.name} · {selectedAssignment.shift} shift
              </div>
            </div>
            <Badge color={WORK_STATUS_COLOR[selectedAssignment.workStatus]}>{selectedAssignment.workStatus.replace("_", " ")}</Badge>
            <span className="text-xs text-[rgb(var(--muted))]">
              {(selectedAssignment.actualMinutes / 60).toFixed(1)}h / {selectedAssignment.hoursBooked}h
            </span>
            {(selectedAssignment.userId === session?.user?.id ||
              selectedAssignment.taskLeadId === session?.user?.id ||
              isLeadOrUp) &&
              isExec && (
                <div className="flex gap-1.5 ml-auto">
                  {CLOCK_ACTIONS.filter((c) => c.show(selectedAssignment.workStatus)).map((c) => (
                    <button
                      key={c.action}
                      disabled={clockBusy === selectedAssignment.id}
                      onClick={() => doClock(selectedAssignment.id, c.action)}
                      className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                        c.action === "COMPLETE"
                          ? "bg-emerald-500 text-white"
                          : c.action === "HOLD" || c.action === "QUERY"
                          ? "bg-amber-500 text-white"
                          : "bg-brand-500 text-white"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-[rgb(var(--muted))] ml-1">
              ✕
            </button>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-semibold">Tasks</h3>
          <Input
            placeholder="Search by job no, task no/name, or person…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-center text-sm text-[rgb(var(--muted))] py-6">No tasks found.</p>}
          {tasks.map((t) => {
            const assignedNames: string[] = t.assignments?.length
              ? Array.from(new Set(t.assignments.map((a: any) => a.user.name as string)))
              : [];
            return (
              <div
                key={t.id}
                className="flex items-center gap-4 rounded-2xl border border-[rgb(var(--border))] p-4 hover:shadow-raised transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{t.name}</span>
                    <Badge color="blue">{t.status.replace("_", " ")}</Badge>
                    <span className="text-xs text-[rgb(var(--muted))]">v{t.version}</span>
                  </div>
                  <div className="text-xs text-[rgb(var(--muted))] mt-1">
                    {t.taskNo} · {t.job?.jobNo} · Lead: {t.lead?.name ?? "—"}
                  </div>
                </div>
                <div className="flex items-center -space-x-2 shrink-0">
                  {assignedNames.slice(0, 4).map((n) => (
                    <Avatar key={n} name={n} size={30} />
                  ))}
                  {assignedNames.length > 4 && (
                    <div className="w-[30px] h-[30px] rounded-full bg-[rgb(var(--border))] flex items-center justify-center text-[10px] font-bold border-2 border-[rgb(var(--card))]">
                      +{assignedNames.length - 4}
                    </div>
                  )}
                  {assignedNames.length === 0 && <span className="text-xs text-[rgb(var(--muted))]">Unassigned</span>}
                </div>
                {isExec && (
                  <button onClick={() => assignSelf(t.id)} disabled={busy} className="btn-secondary text-xs shrink-0">
                    Assign Me
                  </button>
                )}
                {isLeadOrUp && (
                  <button onClick={() => setAssignOpen(t.id)} className="btn-secondary text-xs shrink-0">
                    + Assign
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* New Task Modal */}
      <Modal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} title="Book New Task">
        <div className="space-y-4">
          <div>
            <label className="label">Job</label>
            <Select value={taskForm.jobId} onChange={(e) => setTaskForm({ ...taskForm, jobId: e.target.value })}>
              <option value="">Select job…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNo} — {j.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Task name</label>
            <Input value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Lead</label>
            <Select value={taskForm.leadId} onChange={(e) => setTaskForm({ ...taskForm, leadId: e.target.value })}>
              <option value="">Unassigned</option>
              {people
                .filter((p) => p.role === "PRODUCTION_LEAD")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <Input type="date" value={taskForm.startDate} onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">End date</label>
              <Input type="date" value={taskForm.endDate} onChange={(e) => setTaskForm({ ...taskForm, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Estimated hours</label>
            <Input
              type="number"
              value={taskForm.estimatedHours}
              onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
            />
          </div>
          <button disabled={busy || !taskForm.jobId || !taskForm.name} onClick={createTask} className="btn-primary w-full">
            Create Task
          </button>
        </div>
      </Modal>

      {/* Assign Ops Modal */}
      <Modal open={!!assignOpen} onClose={() => setAssignOpen(null)} title="Assign Facility (Ops) to Task">
        <div className="space-y-4">
          <div>
            <label className="label">Person</label>
            <Select value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}>
              <option value="">Select…</option>
              {opsAndLeads.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Shift</label>
              <Select value={assignForm.shift} onChange={(e) => setAssignForm({ ...assignForm, shift: e.target.value })}>
                {shifts.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="label">Date</label>
              <Input type="date" value={assignForm.date} onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Hours</label>
              <Input
                type="number"
                value={assignForm.hoursBooked}
                onChange={(e) => setAssignForm({ ...assignForm, hoursBooked: e.target.value })}
              />
            </div>
          </div>
          <button disabled={busy || !assignForm.userId} onClick={assignOps} className="btn-primary w-full">
            Assign
          </button>
        </div>
      </Modal>

      {/* Mark Leave Modal */}
      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title={`Mark Leave — ${date}`}>
        <div className="space-y-4">
          <p className="text-xs text-[rgb(var(--muted))]">
            {isLeadOrUp ? "Select one or more people to mark on leave." : "You can mark your own leave."}
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1 border border-[rgb(var(--border))] rounded-lg p-2">
            {(isLeadOrUp ? opsAndLeads : opsAndLeads.filter((p) => p.id === session?.user?.id)).map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm px-1 py-1">
                <input
                  type="checkbox"
                  checked={leaveForm.userIds.includes(p.id)}
                  onChange={(e) => {
                    setLeaveForm((f) => ({
                      ...f,
                      userIds: e.target.checked ? [...f.userIds, p.id] : f.userIds.filter((id) => id !== p.id),
                    }));
                  }}
                />
                {p.name}
              </label>
            ))}
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <Input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
          </div>
          <button disabled={busy || leaveForm.userIds.length === 0} onClick={markLeave} className="btn-primary w-full">
            Mark Leave
          </button>
        </div>
      </Modal>

      {/* EOD Comment Modal */}
      <Modal open={eodOpen} onClose={() => setEodOpen(false)} title={`End-of-Day Comment — ${date}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Related task (optional)</label>
            <Select value={eodForm.taskId} onChange={(e) => setEodForm({ ...eodForm, taskId: e.target.value })}>
              <option value="">General</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.taskNo} — {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Comment</label>
            <Textarea rows={4} value={eodForm.comment} onChange={(e) => setEodForm({ ...eodForm, comment: e.target.value })} />
          </div>
          <button disabled={busy || !eodForm.comment.trim()} onClick={submitEod} className="btn-primary w-full">
            Save
          </button>
        </div>
      </Modal>

      {/* Break Modal */}
      <Modal open={breakOpen} onClose={() => setBreakOpen(false)} title="Take a Break">
        {breakStatus && (
          <div className="space-y-4">
            <p className="text-sm">
              Used today: <span className="font-semibold">{breakStatus.usedMinutes}</span> / {breakStatus.capMinutes} min
            </p>
            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${Math.min(100, (breakStatus.usedMinutes / breakStatus.capMinutes) * 100)}%` }}
              />
            </div>
            <div>
              <label className="label">Minutes</label>
              <Input type="number" min="1" max="60" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
            </div>
            {breakError && <p className="text-sm text-red-600">{breakError}</p>}
            <button disabled={busy} onClick={submitBreak} className="btn-primary w-full">
              Log Break
            </button>
          </div>
        )}
      </Modal>

      {/* Shift Settings Modal */}
      <Modal open={shiftOpen} onClose={() => setShiftOpen(false)} title="Shift Windows">
        <div className="space-y-4">
          {shifts.map((s) => (
            <ShiftRow key={s.code} shift={s} onSave={saveShift} />
          ))}
          <p className="text-xs text-[rgb(var(--muted))]">GEN is the default shift and can be changed here; APAC/EMEA/AMER are fixed regional windows but editable too.</p>
        </div>
      </Modal>
    </div>
  );
}

function ShiftRow({ shift, onSave }: { shift: any; onSave: (code: string, start: string, end: string, breakMins: number) => void }) {
  const [start, setStart] = useState(shift.startTime);
  const [end, setEnd] = useState(shift.endTime);
  const [brk, setBrk] = useState(shift.breakMins);

  return (
    <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] last:border-0 pb-3 last:pb-0">
      <Badge color="purple">{shift.code}</Badge>
      <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
      <span className="text-xs">to</span>
      <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
      <Input
        type="number"
        value={brk}
        onChange={(e) => setBrk(parseInt(e.target.value || "0"))}
        className="w-20"
        title="Break minutes"
      />
      <span className="text-xs text-[rgb(var(--muted))]">min break</span>
      <button onClick={() => onSave(shift.code, start, end, brk)} className="btn-secondary text-xs ml-auto">
        Save
      </button>
    </div>
  );
}
