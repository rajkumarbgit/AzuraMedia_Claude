"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Badge, Card, Select } from "@/components/ui";
import { formatMoney } from "@/lib/currency";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "gray",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  ON_HOLD: "amber",
  CANCELLED: "red",
};

// CLIENT sees only their own jobs (single client, no switcher). CEO and ONSITE_MANAGER can see
// across multiple clients, so they get a client filter built from whatever jobs come back.
const PORTAL_ROLES = ["CLIENT", "CEO", "ONSITE_MANAGER"];

export default function ClientPortalPage() {
  const { data: session, status } = useSession();
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [clientFilter, setClientFilter] = useState("");

  const role = session?.user?.role;
  const canView = !!role && PORTAL_ROLES.includes(role);
  const isMultiClientViewer = role === "CEO" || role === "ONSITE_MANAGER";

  useEffect(() => {
    if (!canView) return;
    const qs = clientFilter ? `?clientId=${clientFilter}` : "";
    fetch(`/api/portal/jobs${qs}`)
      .then((r) => r.json())
      .then(setJobs);
  }, [canView, clientFilter]);

  if (status === "loading") return <p className="text-[rgb(var(--muted))]">Loading…</p>;

  if (!canView) {
    return (
      <Card>
        <p className="text-sm text-[rgb(var(--muted))]">The client portal is only available to client, onsite manager, or CEO accounts.</p>
      </Card>
    );
  }

  const clientOptions = isMultiClientViewer
    ? Array.from(new Map((jobs ?? []).filter((j) => j.client?.id).map((j) => [j.client.id, j.client.name])).entries())
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isMultiClientViewer ? "Client Jobs" : "Your Jobs"}</h1>
          <p className="text-[rgb(var(--muted))] mt-1">Status, history, and approvals for everything we're running.</p>
        </div>
        {isMultiClientViewer && clientOptions.length > 0 && (
          <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-56">
            <option value="">All clients</option>
            {clientOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
            <tr>
              <th className="p-3">Job No</th>
              {isMultiClientViewer && <th className="p-3">Client</th>}
              <th className="p-3">Title</th>
              <th className="p-3">Budget</th>
              <th className="p-3">Status</th>
              <th className="p-3">Pending</th>
            </tr>
          </thead>
          <tbody>
            {jobs === null && (
              <tr>
                <td colSpan={isMultiClientViewer ? 6 : 5} className="p-4 text-center text-[rgb(var(--muted))]">
                  Loading…
                </td>
              </tr>
            )}
            {jobs?.length === 0 && (
              <tr>
                <td colSpan={isMultiClientViewer ? 6 : 5} className="p-4 text-center text-[rgb(var(--muted))]">
                  No jobs yet.
                </td>
              </tr>
            )}
            {jobs?.map((job) => (
              <tr key={job.id} className="border-b border-[rgb(var(--border))] last:border-0 hover:bg-black/5 dark:hover:bg-white/5">
                <td className="p-3">
                  <Link href={`/portal/${job.id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
                    {job.jobNo}
                  </Link>
                </td>
                {isMultiClientViewer && <td className="p-3">{job.client?.name}</td>}
                <td className="p-3">{job.title}</td>
                <td className="p-3">{formatMoney(job.clientBudget, job.currency)}</td>
                <td className="p-3">
                  <Badge color={STATUS_COLOR[job.status]}>{job.status.replace("_", " ")}</Badge>
                </td>
                <td className="p-3">
                  {job.approvals?.length > 0 ? (
                    <Badge color="amber">{job.approvals.length} awaiting your decision</Badge>
                  ) : (
                    <span className="text-[rgb(var(--muted))]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
