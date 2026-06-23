"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge, Card, Input, Modal, Select, StatCard, Textarea } from "@/components/ui";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProductionTimelinePage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isLeadOrUp = ["CEO", "ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD"].includes(role ?? "");

  const [date, setDate] = useState(todayStr());
  const [capacity, setCapacity] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

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
    fetch("/api/jobs")
      .then((r) => r.json())
      .then(setJobs);
    fetch("/api/users")
      .then((r) => r.json())
      .then(setPeople);
    fetch("/api/shifts")
      .then((r) => r.json())
      .then(setShifts);
  }, []);

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

  const opsAndLeads = people.filter((p) => ["OPS", "PRODUCTION_LEAD"].includes(p.role));

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
          <h3 className="font-semibold">Tasks</h3>
          <Input
            placeholder="Search by job no, task no/name, or person…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
              <tr>
                <th className="p-2">Task No</th>
                <th className="p-2">Name</th>
                <th className="p-2">Job</th>
                <th className="p-2">Lead</th>
                <th className="p-2">Status</th>
                <th className="p-2">Version</th>
                <th className="p-2">Booked Ops</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-[rgb(var(--muted))]">
                    No tasks found.
                  </td>
                </tr>
              )}
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="p-2 font-medium">{t.taskNo}</td>
                  <td className="p-2">{t.name}</td>
                  <td className="p-2">{t.job?.jobNo}</td>
                  <td className="p-2">{t.lead?.name ?? "—"}</td>
                  <td className="p-2">
                    <Badge color="blue">{t.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="p-2">v{t.version}</td>
                  <td className="p-2">
                    {t.assignments?.length
                      ? Array.from(new Set(t.assignments.map((a: any) => a.user.name))).join(", ")
                      : "—"}
                  </td>
                  <td className="p-2">
                    {isLeadOrUp && (
                      <button onClick={() => setAssignOpen(t.id)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                        + Assign Ops
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
