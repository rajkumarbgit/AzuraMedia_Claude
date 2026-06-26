"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge, Card, Input, Modal, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/currency";
import { OnlineDot } from "@/components/OnlineDot";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "gray",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  ON_HOLD: "amber",
  CANCELLED: "red",
  ACTIVE: "green",
  REMOVED: "red",
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  NOT_STARTED: "gray",
  BLOCKED: "amber",
  QUERY: "amber",
};

const ACTION_LABEL: Record<string, string> = {
  START: "started",
  RESUME: "resumed",
  HOLD: "put on hold",
  QUERY: "raised a query on",
  COMPLETE: "completed",
};

// Mirrors src/lib/clock.ts's presenceStatus thresholds (can't import that module directly here —
// it pulls in the Prisma client, which shouldn't ship to the browser bundle). onLeave (today's
// Leave record) takes priority and renders as a 4th "out of office" state.
function presenceOf(lastSeenAt?: string | null, onLeave?: boolean): "online" | "away" | "offline" | "leave" {
  if (onLeave) return "leave";
  if (!lastSeenAt) return "offline";
  const elapsed = Date.now() - new Date(lastSeenAt).getTime();
  if (elapsed < 2 * 60 * 1000) return "online";
  if (elapsed < 10 * 60 * 1000) return "away";
  return "offline";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mandateModal, setMandateModal] = useState(false);
  const [mandateName, setMandateName] = useState("");
  const [mandateComment, setMandateComment] = useState("");
  const [mandateCost, setMandateCost] = useState("");
  const [commentModal, setCommentModal] = useState<{ taskId: string | null } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaveUserIds, setLeaveUserIds] = useState<Set<string>>(new Set());

  const role = session?.user?.role;
  const isManager = role === "PROJECT_MANAGER" || role === "CEO" || role === "ADMIN";
  const canComment = ["PROJECT_MANAGER", "PRODUCTION_LEAD", "CEO", "ADMIN"].includes(role ?? "");

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    setJob(await res.json());
    setLoading(false);
  }, [id]);

  const loadLeave = useCallback(async () => {
    const today = todayStr();
    const res = await fetch(`/api/leaves?from=${today}&to=${today}`);
    if (res.ok) {
      const leaves = await res.json();
      setLeaveUserIds(new Set(leaves.map((l: any) => l.userId)));
    }
  }, []);

  useEffect(() => {
    load();
    loadLeave();
    // Refresh periodically so online/offline/leave dots and live work status don't go stale.
    const t = setInterval(() => {
      load();
      loadLeave();
    }, 20000);
    return () => clearInterval(t);
  }, [load, loadLeave]);

  async function submitMandate() {
    setBusy(true);
    await fetch(`/api/jobs/${id}/mandates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mandateName, comment: mandateComment, addedCost: mandateCost || undefined }),
    });
    setBusy(false);
    setMandateModal(false);
    setMandateName("");
    setMandateComment("");
    setMandateCost("");
    load();
  }

  async function reduceMandate(mandateId: string) {
    const comment = isManager ? undefined : window.prompt("Reason for reducing this mandate?") ?? undefined;
    setBusy(true);
    await fetch(`/api/mandates/${mandateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    setBusy(false);
    load();
  }

  async function decide(approvalId: string, decision: "APPROVED" | "REJECTED") {
    const reviewComment = window.prompt(`Comment for this ${decision.toLowerCase()} (optional):`) ?? undefined;
    setBusy(true);
    const res = await fetch(`/api/approvals/${approvalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reviewComment }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to record decision");
      return;
    }
    load();
  }

  async function submitComment() {
    if (!commentText.trim()) return;
    setBusy(true);
    await fetch(`/api/jobs/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: commentText, taskId: commentModal?.taskId ?? undefined }),
    });
    setBusy(false);
    setCommentModal(null);
    setCommentText("");
    load();
  }

  if (loading) return <p className="text-[rgb(var(--muted))]">Loading…</p>;
  if (!job) return <p>Job not found.</p>;

  const pendingApprovals = job.approvals.filter((a: any) => a.status === "PENDING");
  const clientApprovals = pendingApprovals.filter((a: any) => a.type === "MANDATE_ADD");
  const internalApprovals = pendingApprovals.filter((a: any) => a.type !== "MANDATE_ADD");

  // Build a single chronological roadmap across all tasks: assignment start/hold/query/complete
  // events, job/task comments, and EOD comments — "who worked, how many hours, comments".
  const roadmapEvents: any[] = [];
  for (const task of job.tasks ?? []) {
    for (const a of task.assignments ?? []) {
      for (const log of a.timeLogs ?? []) {
        roadmapEvents.push({
          at: log.createdAt,
          kind: "clock",
          taskName: task.name,
          taskNo: task.taskNo,
          userName: a.user?.name,
          userRole: a.user?.role,
          action: log.action,
          note: log.note,
        });
      }
    }
    for (const c of task.comments ?? []) {
      roadmapEvents.push({
        at: c.createdAt,
        kind: "comment",
        taskName: task.name,
        taskNo: task.taskNo,
        userName: c.author?.name,
        userRole: c.author?.role,
        comment: c.comment,
      });
    }
    for (const e of task.eodComments ?? []) {
      roadmapEvents.push({
        at: e.createdAt,
        kind: "eod",
        taskName: task.name,
        taskNo: task.taskNo,
        userName: e.user?.name,
        userRole: e.user?.role,
        comment: e.comment,
      });
    }
  }
  for (const c of job.comments ?? []) {
    roadmapEvents.push({ at: c.createdAt, kind: "comment", taskName: null, userName: c.author?.name, userRole: c.author?.role, comment: c.comment });
  }
  roadmapEvents.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{job.jobNo}</h1>
            <Badge color={STATUS_COLOR[job.status]}>{job.status.replace("_", " ")}</Badge>
            <Badge color="purple">v{job.version}</Badge>
          </div>
          <p className="text-[rgb(var(--muted))] mt-1">{job.title} · {job.client?.name}</p>
        </div>
        {canComment && (
          <button onClick={() => setCommentModal({ taskId: null })} className="btn-secondary text-xs">
            + Add Job Comment
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs text-[rgb(var(--muted))]">Client Budget</div>
          <div className="text-xl font-bold">{formatMoney(job.clientBudget, job.currency)}</div>
        </Card>
        <Card>
          <div className="text-xs text-[rgb(var(--muted))]">Production Spend %</div>
          <div className="text-xl font-bold">{job.productionSpendPercent}%</div>
        </Card>
        <Card>
          <div className="text-xs text-[rgb(var(--muted))]">Production Amount</div>
          <div className="text-xl font-bold">
            {formatMoney((Number(job.clientBudget) * job.productionSpendPercent) / 100, job.currency)}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[rgb(var(--muted))]">Project Manager</div>
          <div className="text-xl font-bold">{job.createdBy?.name}</div>
        </Card>
      </div>

      {job.pmComment && (
        <Card>
          <div className="text-xs text-[rgb(var(--muted))] mb-1">PM Comment</div>
          <p className="text-sm">{job.pmComment}</p>
        </Card>
      )}

      {clientApprovals.length > 0 && (
        <Card className="border-amber-400">
          <h3 className="font-semibold mb-1">Awaiting Client Approval ({clientApprovals.length})</h3>
          <p className="text-xs text-[rgb(var(--muted))] mb-3">
            These cost-increasing mandates can only be approved by the client. Ops cannot start work on this job until approved.
          </p>
          <div className="space-y-3">
            {clientApprovals.map((a: any) => {
              const ci = a.costImpact ?? {};
              return (
                <div key={a.id} className="border-b border-[rgb(var(--border))] last:border-0 pb-3 last:pb-0 text-sm">
                  <div className="font-medium">{(a.payload as any)?.name}</div>
                  <div className="text-[rgb(var(--muted))]">
                    Requested by {a.requestedBy?.name}
                    {a.comment ? ` — "${a.comment}"` : ""}
                  </div>
                  {ci.addedCost ? (
                    <div className="text-xs text-amber-600 mt-1">
                      +{job.currency} {Number(ci.addedCost).toFixed(2)} → new total {job.currency} {Number(ci.newTotal).toFixed(2)}
                    </div>
                  ) : null}
                  <Badge color="amber" className="mt-1">Pending client decision</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isManager && internalApprovals.length > 0 && (
        <Card className="border-amber-400">
          <h3 className="font-semibold mb-3">Pending Approvals ({internalApprovals.length})</h3>
          <div className="space-y-3">
            {internalApprovals.map((a: any) => (
              <div key={a.id} className="flex items-start justify-between gap-4 border-b border-[rgb(var(--border))] last:border-0 pb-3 last:pb-0">
                <div className="text-sm">
                  <div className="font-medium">{a.type.replace(/_/g, " ")}</div>
                  <div className="text-[rgb(var(--muted))]">
                    Requested by {a.requestedBy?.name}
                    {a.comment ? ` — "${a.comment}"` : ""}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button disabled={busy} onClick={() => decide(a.id, "APPROVED")} className="btn-primary text-xs px-3 py-1.5">
                    Approve
                  </button>
                  <button disabled={busy} onClick={() => decide(a.id, "REJECTED")} className="btn-danger text-xs px-3 py-1.5">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Mandates</h3>
          <button onClick={() => setMandateModal(true)} className="btn-secondary text-xs">
            + Request Extra Mandate
          </button>
        </div>
        <div className="space-y-2">
          {job.mandates.length === 0 && <p className="text-sm text-[rgb(var(--muted))]">No mandates yet.</p>}
          {job.mandates.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between border-b border-[rgb(var(--border))] last:border-0 py-2">
              <div className="text-sm">
                <span className="font-medium">{m.name}</span>{" "}
                <Badge color={STATUS_COLOR[m.status]}>{m.status}</Badge>
                {m.addedCost ? (
                  <span className="text-xs text-[rgb(var(--muted))] ml-2">+{job.currency} {Number(m.addedCost).toFixed(2)}</span>
                ) : null}
              </div>
              {m.status === "ACTIVE" && (
                <button disabled={busy} onClick={() => reduceMandate(m.id)} className="text-xs text-red-600 hover:underline">
                  {isManager ? "Remove" : "Request Reduce"}
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Job Roadmap</h3>
        <p className="text-xs text-[rgb(var(--muted))] mb-4">
          Who worked on this job, how long, and their comments — in chronological order.
        </p>
        <div className="space-y-4">
          {roadmapEvents.length === 0 && <p className="text-sm text-[rgb(var(--muted))]">No activity recorded yet.</p>}
          {roadmapEvents.map((ev, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  ev.kind === "clock" ? "bg-brand-500" : ev.kind === "eod" ? "bg-purple-500" : "bg-emerald-500"
                }`}
              />
              <div className="text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  {ev.taskNo && <Badge color="gray">{ev.taskNo}</Badge>}
                  <span className="text-[rgb(var(--muted))] text-xs">{new Date(ev.at).toLocaleString()}</span>
                </div>
                {ev.kind === "clock" && (
                  <p>
                    <span className="font-medium">{ev.userName}</span> ({ev.userRole?.replace("_", " ")}) {ACTION_LABEL[ev.action] ?? ev.action.toLowerCase()} work on{" "}
                    {ev.taskName}
                    {ev.note ? ` — "${ev.note}"` : ""}
                  </p>
                )}
                {ev.kind === "comment" && (
                  <p>
                    <span className="font-medium">{ev.userName}</span> ({ev.userRole?.replace("_", " ")}) commented{ev.taskName ? ` on ${ev.taskName}` : ""}: "{ev.comment}"
                  </p>
                )}
                {ev.kind === "eod" && (
                  <p>
                    <span className="font-medium">{ev.userName}</span> EOD note{ev.taskName ? ` (${ev.taskName})` : ""}: "{ev.comment}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {job.tasks?.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Tasks &amp; Who Worked On Them</h3>
          <div className="space-y-4">
            {job.tasks.map((task: any) => {
              const totalMinutes = (task.assignments ?? []).reduce((sum: number, a: any) => sum + (a.actualMinutes ?? 0), 0);
              return (
                <div key={task.id} className="border-b border-[rgb(var(--border))] last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{task.taskNo} — {task.name}</span>
                      <Badge color={STATUS_COLOR[task.status]}>{task.status.replace("_", " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                      {task.lead && (
                        <span className="flex items-center gap-1.5">
                          <OnlineDot status={presenceOf(task.lead.lastSeenAt, leaveUserIds.has(task.lead.id))} /> Lead: {task.lead.name}
                        </span>
                      )}
                      <span>{(totalMinutes / 60).toFixed(1)}h logged</span>
                      {canComment && (
                        <button onClick={() => setCommentModal({ taskId: task.id })} className="text-brand-600 hover:underline">
                          + Comment
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(task.assignments ?? []).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                        <OnlineDot status={presenceOf(a.user?.lastSeenAt, leaveUserIds.has(a.user?.id))} />
                        <span className="font-medium text-[rgb(var(--fg))]">{a.user?.name}</span>
                        <Badge color="gray">{a.user?.role?.replace("_", " ")}</Badge>
                        <span>{new Date(a.date).toLocaleDateString()} · {a.shift}</span>
                        <Badge color={STATUS_COLOR[a.workStatus]}>{a.workStatus.replace("_", " ")}</Badge>
                        <span>{(a.actualMinutes / 60).toFixed(1)}h worked / {a.hoursBooked}h booked</span>
                      </div>
                    ))}
                    {(task.assignments ?? []).length === 0 && <p className="text-xs text-[rgb(var(--muted))]">No one assigned yet.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={mandateModal} onClose={() => setMandateModal(false)} title="Request Extra Mandate">
        <div className="space-y-4">
          <p className="text-xs text-[rgb(var(--muted))]">
            Extra mandates that increase project cost go to the client for approval before they take effect.
          </p>
          <div>
            <label className="label">Mandate name</label>
            <Input value={mandateName} onChange={(e) => setMandateName(e.target.value)} />
          </div>
          <div>
            <label className="label">Added cost ({job.currency}, optional)</label>
            <Input type="number" min="0" step="0.01" value={mandateCost} onChange={(e) => setMandateCost(e.target.value)} />
          </div>
          <div>
            <label className="label">Comment (why is this needed?)</label>
            <Textarea rows={3} value={mandateComment} onChange={(e) => setMandateComment(e.target.value)} />
          </div>
          <button disabled={busy || !mandateName.trim()} onClick={submitMandate} className="btn-primary w-full">
            Submit for Client Approval
          </button>
        </div>
      </Modal>

      <Modal open={!!commentModal} onClose={() => setCommentModal(null)} title="Add Comment">
        <div className="space-y-4">
          <Textarea rows={4} placeholder="Comment…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <button disabled={busy || !commentText.trim()} onClick={submitComment} className="btn-primary w-full">
            Post Comment
          </button>
        </div>
      </Modal>
    </div>
  );
}
