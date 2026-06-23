"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge, Card, Input, Modal, Textarea } from "@/components/ui";
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
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mandateModal, setMandateModal] = useState(false);
  const [mandateName, setMandateName] = useState("");
  const [mandateComment, setMandateComment] = useState("");
  const [busy, setBusy] = useState(false);

  const role = session?.user?.role;
  const isManager = role === "PROJECT_MANAGER" || role === "CEO" || role === "ADMIN";

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    setJob(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitMandate() {
    setBusy(true);
    await fetch(`/api/jobs/${id}/mandates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mandateName, comment: mandateComment }),
    });
    setBusy(false);
    setMandateModal(false);
    setMandateName("");
    setMandateComment("");
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
    await fetch(`/api/approvals/${approvalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reviewComment }),
    });
    setBusy(false);
    load();
  }

  if (loading) return <p className="text-[rgb(var(--muted))]">Loading…</p>;
  if (!job) return <p>Job not found.</p>;

  const pendingApprovals = job.approvals.filter((a: any) => a.status === "PENDING");

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

      {isManager && pendingApprovals.length > 0 && (
        <Card className="border-amber-400">
          <h3 className="font-semibold mb-3">Pending Approvals ({pendingApprovals.length})</h3>
          <div className="space-y-3">
            {pendingApprovals.map((a: any) => (
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
            {isManager ? "+ Add Mandate" : "Request Extra Mandate"}
          </button>
        </div>
        <div className="space-y-2">
          {job.mandates.length === 0 && <p className="text-sm text-[rgb(var(--muted))]">No mandates yet.</p>}
          {job.mandates.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between border-b border-[rgb(var(--border))] last:border-0 py-2">
              <div className="text-sm">
                <span className="font-medium">{m.name}</span>{" "}
                <Badge color={STATUS_COLOR[m.status]}>{m.status}</Badge>
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
        <h3 className="font-semibold mb-3">Timeline</h3>
        <div className="space-y-4">
          {job.timelineEvents.map((ev: any) => (
            <div key={ev.id} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge color="purple">v{ev.version}</Badge>
                  <span className="text-[rgb(var(--muted))] text-xs">{new Date(ev.createdAt).toLocaleString()}</span>
                </div>
                <p>{ev.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={mandateModal} onClose={() => setMandateModal(false)} title={isManager ? "Add Mandate" : "Request Extra Mandate"}>
        <div className="space-y-4">
          <div>
            <label className="label">Mandate name</label>
            <Input value={mandateName} onChange={(e) => setMandateName(e.target.value)} />
          </div>
          <div>
            <label className="label">Comment {isManager ? "(optional)" : "(why is this needed?)"}</label>
            <Textarea rows={3} value={mandateComment} onChange={(e) => setMandateComment(e.target.value)} />
          </div>
          <button disabled={busy || !mandateName.trim()} onClick={submitMandate} className="btn-primary w-full">
            {isManager ? "Add" : "Submit Request"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
