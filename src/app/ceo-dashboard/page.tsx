"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { StatCard, Card, Input, Select, AlertBanner } from "@/components/ui";
import { formatMoney } from "@/lib/currency";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-ink text-white px-3 py-2 text-xs font-semibold shadow-popover">
      <div className="text-white/60 font-medium mb-0.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey}>{p.value} jobs</div>
      ))}
    </div>
  );
}

export default function CeoDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/ceo")
      .then((r) => r.json())
      .then(setData);
  }, []);

  async function runSearch() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (minBudget) params.set("minBudget", minBudget);
    if (maxBudget) params.set("maxBudget", maxBudget);
    const res = await fetch(`/api/jobs?${params.toString()}`);
    setSearchResults(await res.json());
  }

  if (!data) return <p className="text-[rgb(var(--muted))]">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">CEO Dashboard</h1>

      {data.pendingApprovals > 0 && (
        <AlertBanner
          variant="warning"
          title={`${data.pendingApprovals} mandate change request${data.pendingApprovals > 1 ? "s" : ""} awaiting your approval`}
          message="Review and approve or reject pending budget/mandate changes."
          actionLabel="Review Jobs"
          href="/jobs"
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={data.totalJobs} />
        <StatCard label="Completed" value={data.completedCount} accent="green" />
        <StatCard label="In Progress" value={data.inProgressCount} accent="blue" />
        <StatCard label="Pending Approvals" value={data.pendingApprovals} accent="amber" />
        <StatCard label="Total Earning (realized)" value={`$${data.totalEarning.toLocaleString()}`} accent="green" />
        <StatCard label="Forecast Earning" value={`$${data.forecastEarning.toLocaleString()}`} accent="brand" />
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Jobs by Status</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.byStatus} barCategoryGap="32%">
            <defs>
              <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#28C5FF" />
                <stop offset="100%" stopColor="#1B4DFF" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="status" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(27,77,255,0.06)" }} />
            <Bar dataKey="count" fill="url(#barFill)" radius={[10, 10, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">In-Progress Jobs — Owner & Estimated Time</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
              <tr>
                <th className="p-2">Job No</th>
                <th className="p-2">Title</th>
                <th className="p-2">Client</th>
                <th className="p-2">PM</th>
                <th className="p-2">Est. Hours</th>
                <th className="p-2">Budget</th>
              </tr>
            </thead>
            <tbody>
              {data.inProgressDetail.map((j: any) => (
                <tr key={j.id} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="p-2">
                    <Link href={`/jobs/${j.id}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                      {j.jobNo}
                    </Link>
                  </td>
                  <td className="p-2">{j.title}</td>
                  <td className="p-2">{j.client}</td>
                  <td className="p-2">{j.pm}</td>
                  <td className="p-2">{j.estimatedHours ?? "—"}</td>
                  <td className="p-2">{formatMoney(j.budget, j.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Search — by job, money, or people</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <Input placeholder="Job no / title / client / PM name" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input placeholder="Min budget" type="number" value={minBudget} onChange={(e) => setMinBudget(e.target.value)} />
          <Input placeholder="Max budget" type="number" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} />
          <button onClick={runSearch} className="btn-primary">
            Search
          </button>
        </div>
        {searchResults && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
                <tr>
                  <th className="p-2">Job No</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Client</th>
                  <th className="p-2">Budget</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">PM</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-3 text-center text-[rgb(var(--muted))]">
                      No matches.
                    </td>
                  </tr>
                )}
                {searchResults.map((j) => (
                  <tr key={j.id} className="border-b border-[rgb(var(--border))] last:border-0">
                    <td className="p-2">
                      <Link href={`/jobs/${j.id}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                        {j.jobNo}
                      </Link>
                    </td>
                    <td className="p-2">{j.title}</td>
                    <td className="p-2">{j.client?.name}</td>
                    <td className="p-2">{formatMoney(j.clientBudget, j.currency)}</td>
                    <td className="p-2">{j.status}</td>
                    <td className="p-2">{j.createdBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
