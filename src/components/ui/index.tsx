"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-6 ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  accent = "brand",
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "brand" | "green" | "amber" | "red" | "blue";
  highlight?: boolean;
}) {
  const dotMap: Record<string, string> = {
    brand: "bg-brand-500",
    green: "bg-success-500",
    amber: "bg-warning-500",
    red: "bg-danger-500",
    blue: "bg-info-500",
  };
  const valueMap: Record<string, string> = {
    brand: "text-brand-600 dark:text-brand-400",
    green: "text-success-600 dark:text-success-500",
    amber: "text-warning-600 dark:text-warning-500",
    red: "text-danger-600 dark:text-danger-500",
    blue: "text-blue-600 dark:text-blue-400",
  };

  if (highlight) {
    return (
      <div className="rounded-2xl bg-brand-500 text-white shadow-primary p-6 flex flex-col gap-4">
        <span className="text-xs font-bold uppercase tracking-wide text-white/70">{label}</span>
        <span className="text-3xl font-extrabold tracking-tight">{value}</span>
        {sub && <span className="text-xs font-medium text-white/70">{sub}</span>}
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[rgb(var(--muted))]">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotMap[accent]}`} />
        {label}
      </div>
      <div className={`text-3xl font-extrabold tracking-tight ${valueMap[accent]}`}>{value}</div>
      {sub && <div className="text-xs font-medium text-[rgb(var(--muted))]">{sub}</div>}
    </Card>
  );
}

export function Badge({
  children,
  color = "gray",
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  const colorMap: Record<string, string> = {
    gray: "bg-[rgb(var(--border))]/60 text-[rgb(var(--fg))]",
    green: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
    amber: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500",
    red: "bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-500",
    blue: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return <span className={`badge ${colorMap[color] ?? colorMap.gray} ${className}`}>{children}</span>;
}

// Four-state presence: green = online, yellow = away, red = offline, red-with-slash = on
// leave / out of office (takes priority over the heartbeat-derived state).
export type Presence = "online" | "away" | "offline" | "leave";

const PRESENCE_COLOR: Record<Presence, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-red-500",
  leave: "bg-red-500",
};
const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Online",
  away: "Away",
  offline: "Offline",
  leave: "Out of Office",
};

export function Avatar({
  name,
  size = 36,
  presence,
}: {
  name: string;
  size?: number;
  // When provided, renders a small red/yellow/green dot on the avatar showing live presence.
  presence?: Presence;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const gradients = [
    "from-[#7C9DF6] to-[#3C63E6]",
    "from-[#F6A48A] to-[#E0613C]",
    "from-[#7AD3A8] to-[#1FA56F]",
    "from-[#C4A3F6] to-[#7C4DE0]",
    "from-[#9AA0AC] to-[#5B6170]",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const gradient = gradients[Math.abs(hash) % gradients.length];
  const dotSize = Math.max(8, Math.round(size * 0.3));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={presence ? `${name} — ${PRESENCE_LABEL[presence]}` : name}>
      <div
        className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold border-2 border-[rgb(var(--card))]`}
        style={{ fontSize: Math.max(10, size * 0.36) }}
      >
        {initials || "?"}
      </div>
      {presence && (
        <span
          className={`absolute bottom-0 right-0 flex items-center justify-center rounded-full ring-2 ring-[rgb(var(--card))] ${PRESENCE_COLOR[presence]}`}
          style={{ width: dotSize, height: dotSize }}
        >
          {presence === "leave" && (
            <span
              className="bg-white rounded-full"
              style={{ width: dotSize * 0.78, height: Math.max(1, dotSize * 0.16), transform: "rotate(-45deg)" }}
            />
          )}
        </span>
      )}
    </div>
  );
}

export function AlertBanner({
  title,
  message,
  actionLabel,
  onAction,
  href,
  variant = "warning",
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  variant?: "warning" | "danger" | "info" | "success";
}) {
  const styles: Record<string, { bg: string; icon: string; bar: string }> = {
    warning: { bg: "bg-warning-50 dark:bg-warning-500/10", icon: "text-warning-600 dark:text-warning-500", bar: "bg-warning-500" },
    danger: { bg: "bg-danger-50 dark:bg-danger-500/10", icon: "text-danger-600 dark:text-danger-500", bar: "bg-danger-500" },
    info: { bg: "bg-brand-50 dark:bg-brand-500/10", icon: "text-brand-600 dark:text-brand-400", bar: "bg-brand-500" },
    success: { bg: "bg-success-50 dark:bg-success-500/10", icon: "text-success-600 dark:text-success-500", bar: "bg-success-500" },
  };
  const s = styles[variant];
  const action = actionLabel
    ? href
      ? (
          <Link href={href} className="btn-primary text-xs px-4 py-2 shrink-0">
            {actionLabel}
          </Link>
        )
      : (
          <button onClick={onAction} className="btn-primary text-xs px-4 py-2 shrink-0">
            {actionLabel}
          </button>
        )
    : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${s.bg} p-4 pl-5 flex items-center gap-4`}>
      <span className={`absolute left-0 top-0 h-full w-1.5 ${s.bar}`} />
      <AlertTriangle size={20} className={`${s.icon} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{title}</div>
        {message && <div className="text-xs text-[rgb(var(--muted))] mt-0.5">{message}</div>}
      </div>
      {action}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ""}`} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-[rgb(var(--muted))] hover:text-current">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
