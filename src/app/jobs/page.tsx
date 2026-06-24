"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Badge, Input } from "@/components/ui";
import { formatMoney } from "@/lib/currency";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "gray",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  ON_HOLD: "amber",
  CANCELLED: "red",
};

export default function JobsPage() {
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/jobs?q=${encodeURIComponent(q)}`);
    setJobs(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);

  const canCreate = ["PROJECT_MANAGER", "CEO", "ADMIN"].includes(session?.user?.role ?? "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Jobs</h1>
        {canCreate && (
          <Link href="/jobs/new" className="btn-primary">
            + New Job
          </Link>
        )}
      </div>

      <Input
        placeholder="Search by job no, title, client, or PM name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
            <tr>
              <th className="p-3">Job No</th>
              <th className="p-3">Title</th>
              <th className="p-3">Client</th>
              <th className="p-3">Budget</th>
              <th className="p-3">Prod %</th>
              <th className="p-3">Status</th>
              <th className="p-3">Version</th>
              <th className="p-3">PM</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-[rgb(var(--muted))]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-[rgb(var(--muted))]">
                  No jobs found.
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-[rgb(var(--border))] last:border-0 hover:bg-black/5 dark:hover:bg-white/5">
                <td className="p-3">
                  <Link href={`/jobs/${job.id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
                    {job.jobNo}
                  </Link>
                </td>
                <td className="p-3">{job.title}</td>
                <td className="p-3">{job.client?.name}</td>
                <td className="p-3">{formatMoney(job.clientBudget, job.currency)}</td>
                <td className="p-3">{job.productionSpendPercent}%</td>
                <td className="p-3">
                  <Badge color={STATUS_COLOR[job.status]}>{job.status.replace("_", " ")}</Badge>
                </td>
                <td className="p-3">v{job.version}</td>
                <td className="p-3">{job.createdBy?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
