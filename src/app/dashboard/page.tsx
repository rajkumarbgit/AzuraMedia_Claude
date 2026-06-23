"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Badge, Card, StatCard } from "@/components/ui";

export default function MyDashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard/me")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!session || !data) return <p className="text-[rgb(var(--muted))]">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome, {session.user.name}</h1>

      {data.role === "PROJECT_MANAGER" && (
        <>
          <Card>
            <h3 className="font-semibold mb-3">Pending Approvals on Your Jobs ({data.pendingApprovals.length})</h3>
            {data.pendingApprovals.length === 0 && <p className="text-sm text-[rgb(var(--muted))]">Nothing waiting on you.</p>}
            {data.pendingApprovals.map((a: any) => (
              <div key={a.id} className="text-sm border-b border-[rgb(var(--border))] last:border-0 py-2">
                <Link href={`/jobs`} className="text-brand-600 dark:text-brand-400 hover:underline">
                  {a.job.jobNo}
                </Link>{" "}
                — {a.type.replace(/_/g, " ")} requested by {a.requestedBy.name}
              </div>
            ))}
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Your Recent Jobs</h3>
            <div className="space-y-2">
              {data.myJobs.map((j: any) => (
                <div key={j.id} className="flex items-center justify-between border-b border-[rgb(var(--border))] last:border-0 py-2 text-sm">
                  <Link href={`/jobs/${j.id}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                    {j.jobNo} — {j.title}
                  </Link>
                  <Badge color="blue">{j.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {data.role === "PRODUCTION_LEAD" && (
        <>
          <Card>
            <h3 className="font-semibold mb-3">Your Tasks</h3>
            <div className="space-y-2">
              {data.myTasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between border-b border-[rgb(var(--border))] last:border-0 py-2 text-sm">
                  <span>
                    {t.taskNo} — {t.name} ({t.job?.jobNo})
                  </span>
                  <Badge color="blue">{t.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Team On Leave Today</h3>
            {data.teamLeaves.length === 0 ? (
              <p className="text-sm text-[rgb(var(--muted))]">Everyone is available today.</p>
            ) : (
              data.teamLeaves.map((l: any) => (
                <div key={l.id} className="text-sm py-1">
                  {l.user.name} {l.reason ? `— ${l.reason}` : ""}
                </div>
              ))
            )}
          </Card>
          <Link href="/production" className="btn-secondary inline-block">
            Open Production Timeline →
          </Link>
        </>
      )}

      {data.role === "OPS" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Today's Capacity" value={`${data.capacityHours}h`} />
            <StatCard label="Booked Today" value={`${data.bookedHours}h`} accent="blue" />
            <StatCard label="Remaining Today" value={`${data.remainingHours}h`} accent="green" />
          </div>
          {data.onLeaveToday && <Card className="border-amber-400">You're marked on leave today.</Card>}
          <Card>
            <h3 className="font-semibold mb-3">Today's Assignments</h3>
            {data.myAssignmentsToday.length === 0 && <p className="text-sm text-[rgb(var(--muted))]">No bookings today.</p>}
            {data.myAssignmentsToday.map((a: any) => (
              <div key={a.id} className="text-sm border-b border-[rgb(var(--border))] last:border-0 py-2">
                {a.task.taskNo} — {a.task.name} ({a.task.job.jobNo}) · {a.shift} shift · {a.hoursBooked}h
              </div>
            ))}
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Upcoming</h3>
            {data.myUpcoming.map((a: any) => (
              <div key={a.id} className="text-sm border-b border-[rgb(var(--border))] last:border-0 py-2">
                {new Date(a.date).toLocaleDateString()} — {a.task.taskNo} ({a.hoursBooked}h)
              </div>
            ))}
          </Card>
        </>
      )}

      {(data.role === "CEO" || data.role === "ADMIN") && (
        <Card>
          <p className="text-sm text-[rgb(var(--muted))] mb-3">
            Use the dedicated dashboards for full visibility:
          </p>
          <div className="flex gap-3">
            <Link href="/ceo-dashboard" className="btn-primary">
              CEO Dashboard
            </Link>
            <Link href="/admin" className="btn-secondary">
              Admin Panel
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
