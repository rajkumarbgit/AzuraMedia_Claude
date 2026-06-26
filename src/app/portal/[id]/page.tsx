"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge, Card, Modal, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/currency";

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

export default function ClientJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amendModal, setAmendModal] = useState(false);
  const [amendText, setAmendText] = useState("");

  const role = session?.user?.role;
  // CEO can view the roadmap for oversight only. CLIENT and their tagged ONSITE_MANAGER can
  // both approve/reject mandates and request amendments — the onsite manager acts on the
  // client's behalf (enforced server-side too, in /api/approvals/[id]).
  const canView = role === "CLIENT" || role === "CEO" || role === "ONSITE_MANAGER";
  const canDecide = role === "CLIENT" || role === "ONSITE_MANAGER";

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/jobs/${id}`);
    if (res.ok) setJob(await res.json());
    else setJob(null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

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

  async function submitAmendRequest() {
    if (!amendText.trim()) return;
    setBusy(true);
    await fetch(`/api/jobs/${id}/amend-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: amendText }),
    });
    setBusy(false);
    setAmendModal(false);
    setAmendText("");
    load();
  }

  if (!canView) {
    return (
      <Card>
        <p className="text-sm text-[rgb(var(--muted))]">The client portal is only available to client, onsite manager, or CEO accounts.</p>
      </Card>
    );
  }

  if (loading) return <p className="text-[rgb(var(--muted))]">Loading…</p>;
  if (!job) return <p>Job not found.</p>;

  const clientApprovals = job.approvals.filter((a: any) => a.status === "PENDING" && a.type === "MANDATE_ADD");
  const myAmendRequests = job.approvals.filter((a: any) => a.type === "JOB_AMEND");

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
          </div>
          <p className="text-[rgb(var(--muted))] mt-1">{job.title}</p>
        </div>
        {canDecide && (
          <button onClick={() => setAmendModal(true)} className="btn-secondary text-xs">
            Request Amendment
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs text-[rgb(var(--muted))]">Project Budget</div>
          <div className="text-xl font-bold">{formatMoney(job.clientBudget, job.currency)}</div>
        </Card>
        <Card>
          <div className="text-xs text-[rgb(var(--muted))]">Project Manager</div>
          <div className="text-xl font-bold">{job.createdBy?.name}</div>
        </Card>
      </div>

      {clientApprovals.length > 0 && (
        <Card className="border-amber-400">
          <h3 className="font-semibold mb-1">Awaiting Your Approval ({clientApprovals.length})</h3>
          <p className="text-xs text-[rgb(var(--muted))] mb-3">
            Our team has proposed extra work that increases your project cost. Work cannot start until you approve.
          </p>
          <div className="space-y-3">
            {clientApprovals.map((a: any) => {
              const ci = a.costImpact ?? {};
              return (
                <div key={a.id} className="border-b border-[rgb(var(--border))] last:border-0 pb-3 last:pb-0 text-sm">
                  <div className="font-medium">{(a.payload as any)?.name}</div>
                  {(a.payload as any)?.description && <p className="text-[rgb(var(--muted))]">{(a.payload as any).description}</p>}
                  <div className="text-[rgb(var(--muted))]">
                    Requested by {a.requestedBy?.name}
                    {a.comment ? ` — "${a.comment}"` : ""}
                  </div>
                  {ci.addedCost ? (
                    <div className="text-xs text-amber-600 mt-1">
                      +{job.currency} {Number(ci.addedCost).toFixed(2)} → new total {job.currency} {Number(ci.newTotal).toFixed(2)}
                    </div>
                  ) : null}
                  {canDecide && (
                    <div className="flex gap-2 mt-2">
                      <button disabled={busy} onClick={() => decide(a.id, "APPROVED")} className="btn-primary text-xs px-3 py-1.5">
                        Approve
                      </button>
                      <button disabled={busy} onClick={() => decide(a.id, "REJECTED")} className="btn-danger text-xs px-3 py-1.5">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {myAmendRequests.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Your Amendment Requests</h3>
          <div className="space-y-2">
            {myAmendRequests.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between border-b border-[rgb(var(--border))] last:border-0 py-2 text-sm">
                <span>{a.comment}</span>
                <Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {job.mandates?.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Mandates</h3>
          <div className="space-y-2">
            {job.mandates.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between border-b border-[rgb(var(--border))] last:border-0 py-2">
                <div className="text-sm">
                  <span className="font-medium">{m.name}</span>{" "}
                  <Badge color={STATUS_COLOR[m.status]}>{m.status}</Badge>
                  {m.addedCost ? (
                    <span className="text-xs text-[rgb(var(--muted))] ml-2">+{job.currency} {Number(m.addedCost).toFixed(2)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-3">Job History</h3>
        <p className="text-xs text-[rgb(var(--muted))] mb-4">Everything our team has done on this job, in order.</p>
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
                    <span className="font-medium">{ev.userName}</span> {ACTION_LABEL[ev.action] ?? ev.action.toLowerCase()} work on {ev.taskName}
                    {ev.note ? ` — "${ev.note}"` : ""}
                  </p>
                )}
                {ev.kind === "comment" && (
                  <p>
                    <span className="font-medium">{ev.userName}</span> commented{ev.taskName ? ` on ${ev.taskName}` : ""}: "{ev.comment}"
                  </p>
                )}
                {ev.kind === "eod" && (
                  <p>
                    <span className="font-medium">{ev.userName}</span> end-of-day note{ev.taskName ? ` (${ev.taskName})` : ""}: "{ev.comment}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {job.tasks?.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Work Logged</h3>
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
                    <span className="text-xs text-[rgb(var(--muted))]">{(totalMinutes / 60).toFixed(1)}h logged</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(task.assignments ?? []).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                        <span className="font-medium text-[rgb(var(--fg))]">{a.user?.name}</span>
                        <Badge color="gray">{a.user?.role?.replace("_", " ")}</Badge>
                        <span>{new Date(a.date).toLocaleDateString()}</span>
                        <Badge color={STATUS_COLOR[a.workStatus]}>{a.workStatus.replace("_", " ")}</Badge>
                        <span>{(a.actualMinutes / 60).toFixed(1)}h worked</span>
                      </div>
                    ))}
                    {(task.assignments ?? []).length === 0 && <p className="text-xs text-[rgb(var(--muted))]">No work logged yet.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={amendModal} onClose={() => setAmendModal(false)} title="Request Amendment">
        <div className="space-y-4">
          <p className="text-xs text-[rgb(var(--muted))]">
            Describe the change you'd like — to scope, timeline, or anything else on this job, ongoing or completed. Our team will review it.
          </p>
          <Textarea rows={4} placeholder="What would you like changed?" value={amendText} onChange={(e) => setAmendText(e.target.value)} />
          <button disabled={busy || !amendText.trim()} onClick={submitAmendRequest} className="btn-primary w-full">
            Submit Request
          </button>
        </div>
      </Modal>
    </div>
  );
}
