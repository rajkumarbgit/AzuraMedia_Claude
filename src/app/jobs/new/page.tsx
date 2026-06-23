"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui";
import { CURRENCIES } from "@/lib/currency";

export default function NewJobPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [mandates, setMandates] = useState<string[]>([""]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    jobNo: "",
    title: "",
    clientId: "",
    currency: "USD",
    clientBudget: "",
    productionSpendPercent: "",
    pmComment: "",
    estimatedHours: "",
  });

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        clientBudget: parseFloat(form.clientBudget),
        productionSpendPercent: parseFloat(form.productionSpendPercent),
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
        mandates,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create job");
      return;
    }
    const job = await res.json();
    router.push(`/jobs/${job.id}`);
  }

  const productionAmount =
    form.clientBudget && form.productionSpendPercent
      ? ((parseFloat(form.clientBudget) * parseFloat(form.productionSpendPercent)) / 100).toFixed(2)
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New Job</h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Job No *</label>
            <Input required value={form.jobNo} onChange={(e) => update("jobNo", e.target.value)} placeholder="JOB-2026-001" />
          </div>
          <div>
            <label className="label">Client *</label>
            <Select required value={form.clientId} onChange={(e) => update("clientId", e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="label">Job Title *</label>
          <Input required value={form.title} onChange={(e) => update("title", e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Currency *</label>
            <Select value={form.currency} onChange={(e) => update("currency", e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Client Budget *</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.clientBudget}
              onChange={(e) => update("clientBudget", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Production Spend % *</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              required
              value={form.productionSpendPercent}
              onChange={(e) => update("productionSpendPercent", e.target.value)}
            />
          </div>
        </div>
        {productionAmount && (
          <p className="text-xs text-[rgb(var(--muted))]">
            Production team will receive ≈ {form.currency} {productionAmount} of this job's value.
          </p>
        )}

        <div>
          <label className="label">Estimated Hours</label>
          <Input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={(e) => update("estimatedHours", e.target.value)} />
        </div>

        <div>
          <label className="label">Mandates</label>
          <div className="space-y-2">
            {mandates.map((m, i) => (
              <Input
                key={i}
                placeholder={`Mandate ${i + 1} name`}
                value={m}
                onChange={(e) => {
                  const copy = [...mandates];
                  copy[i] = e.target.value;
                  setMandates(copy);
                }}
              />
            ))}
          </div>
          <button type="button" onClick={() => setMandates([...mandates, ""])} className="btn-secondary mt-2 text-xs">
            + Add another mandate
          </button>
        </div>

        <div>
          <label className="label">Project Manager Comment</label>
          <Textarea rows={3} value={form.pmComment} onChange={(e) => update("pmComment", e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Creating…" : "Create Job"}
          </button>
        </div>
      </form>
    </div>
  );
}
