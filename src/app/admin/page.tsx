"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Input, Select } from "@/components/ui";
import { CURRENCIES } from "@/lib/currency";

const ROLES = ["CEO", "ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD", "OPS"];
const TABS = ["Users", "Clients", "Designations", "Page Permissions"] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Users");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>
      <div className="flex gap-2 border-b border-[rgb(var(--border))]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t ? "border-brand-600 text-brand-600 dark:text-brand-400" : "border-transparent text-[rgb(var(--muted))]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Users" && <UsersTab />}
      {tab === "Clients" && <ClientsTab />}
      {tab === "Designations" && <DesignationsTab />}
      {tab === "Page Permissions" && <PermissionsTab />}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "OPS", designationId: "", defaultShift: "GEN" });
  const [error, setError] = useState("");

  async function load() {
    const [u, d] = await Promise.all([fetch("/api/users").then((r) => r.json()), fetch("/api/designations").then((r) => r.json())]);
    setUsers(u);
    setDesignations(d);
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed");
      return;
    }
    setForm({ name: "", email: "", password: "", role: "OPS", designationId: "", defaultShift: "GEN" });
    load();
  }

  async function removeUser(id: string) {
    if (!window.confirm("Deactivate this user?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <h3 className="font-semibold mb-3">Add User</h3>
        <form onSubmit={addUser} className="space-y-3">
          <Input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            placeholder="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            placeholder="Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </Select>
          <Select value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
            <option value="">No designation</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={form.defaultShift} onChange={(e) => setForm({ ...form, defaultShift: e.target.value })}>
            {["APAC", "EMEA", "AMER", "GEN"].map((s) => (
              <option key={s} value={s}>
                {s} shift
              </option>
            ))}
          </Select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full">Add User</button>
        </form>
      </Card>

      <Card className="lg:col-span-2 overflow-x-auto">
        <h3 className="font-semibold mb-3">Users</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Designation</th>
              <th className="p-2">Shift</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[rgb(var(--border))] last:border-0">
                <td className="p-2 font-medium">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  <Badge color="blue">{u.role.replace("_", " ")}</Badge>
                </td>
                <td className="p-2">{u.designation?.name ?? "—"}</td>
                <td className="p-2">{u.defaultShift}</td>
                <td className="p-2">
                  <button onClick={() => removeUser(u.id)} className="text-xs text-red-600 hover:underline">
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ClientsTab() {
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "", currency: "USD" });
  const [error, setError] = useState("");

  function load() {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }
  useEffect(load, []);

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed");
      return;
    }
    setForm({ name: "", contactName: "", contactEmail: "", currency: "USD" });
    load();
  }

  async function removeClient(id: string) {
    if (!window.confirm("Delete this client account?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <h3 className="font-semibold mb-3">Add Client Account</h3>
        <form onSubmit={addClient} className="space-y-3">
          <Input placeholder="Client name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            placeholder="Contact name"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
          <Input
            placeholder="Contact email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
          <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full">Add Client</button>
        </form>
      </Card>

      <Card className="lg:col-span-2 overflow-x-auto">
        <h3 className="font-semibold mb-3">Client Accounts</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Contact</th>
              <th className="p-2">Currency</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-[rgb(var(--border))] last:border-0">
                <td className="p-2 font-medium">{c.name}</td>
                <td className="p-2">{c.contactName ?? "—"} {c.contactEmail ? `· ${c.contactEmail}` : ""}</td>
                <td className="p-2">{c.currency}</td>
                <td className="p-2">
                  <button onClick={() => removeClient(c.id)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function DesignationsTab() {
  const [designations, setDesignations] = useState<any[]>([]);
  const [name, setName] = useState("");

  function load() {
    fetch("/api/designations")
      .then((r) => r.json())
      .then(setDesignations);
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/designations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this designation?")) return;
    await fetch(`/api/designations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Card className="max-w-md">
      <h3 className="font-semibold mb-3">Designations</h3>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <Input placeholder="e.g. Senior Editor" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary">Add</button>
      </form>
      <div className="space-y-2">
        {designations.map((d) => (
          <div key={d.id} className="flex items-center justify-between border-b border-[rgb(var(--border))] last:border-0 py-2">
            <span className="text-sm">{d.name}</span>
            <button onClick={() => remove(d.id)} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PermissionsTab() {
  const [data, setData] = useState<any>(null);

  function load() {
    fetch("/api/permissions")
      .then((r) => r.json())
      .then(setData);
  }
  useEffect(load, []);

  async function toggle(role: string, pageId: string, current: boolean) {
    await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, pageId, canAccess: !current }),
    });
    load();
  }

  if (!data) return <p className="text-[rgb(var(--muted))]">Loading…</p>;

  return (
    <Card className="overflow-x-auto">
      <h3 className="font-semibold mb-1">Page Access Permissions</h3>
      <p className="text-xs text-[rgb(var(--muted))] mb-3">CEO always has full access. Toggle access for other roles below.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-[rgb(var(--muted))] border-b border-[rgb(var(--border))]">
          <tr>
            <th className="p-2">Role</th>
            {data.pages.map((p: any) => (
              <th key={p.id} className="p-2">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.matrix.map((row: any) => (
            <tr key={row.role} className="border-b border-[rgb(var(--border))] last:border-0">
              <td className="p-2 font-medium">
                <Badge color="blue">{row.role.replace("_", " ")}</Badge>
              </td>
              {row.pages.map((p: any) => (
                <td key={p.pageId} className="p-2">
                  <input type="checkbox" checked={p.canAccess} onChange={() => toggle(row.role, p.pageId, p.canAccess)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
