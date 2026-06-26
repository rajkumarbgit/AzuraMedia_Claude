// Small presence indicator — green/yellow/red matching src/lib/clock.ts's presenceStatus
// thresholds (online < 2 min since last heartbeat, away < 10 min, offline beyond that / never).
// A 4th state, "leave", overrides all of the above when the person is on leave / out of
// office today — same red as offline, but with a diagonal slash so it reads distinctly.
// Accepts either the new `status` prop or the legacy boolean `online` prop.
type Status = "online" | "away" | "offline" | "leave";

const COLOR: Record<Status, string> = {
  online: "bg-emerald-500 ring-2 ring-emerald-500/25",
  away: "bg-amber-500 ring-2 ring-amber-500/25",
  offline: "bg-red-500 ring-2 ring-red-500/25",
  leave: "bg-red-500 ring-2 ring-red-500/25",
};
const LABEL: Record<Status, string> = { online: "Online", away: "Away", offline: "Offline", leave: "Out of Office" };

export function OnlineDot({
  status,
  online,
  className = "",
}: {
  status?: Status;
  online?: boolean;
  className?: string;
}) {
  const resolved: Status = status ?? (online ? "online" : "offline");
  return (
    <span
      className={`relative inline-flex items-center justify-center w-2.5 h-2.5 rounded-full shrink-0 ${COLOR[resolved]} ${className}`}
      title={LABEL[resolved]}
    >
      {resolved === "leave" && (
        <span className="bg-white rounded-full" style={{ width: "78%", height: "1.5px", transform: "rotate(-45deg)" }} />
      )}
    </span>
  );
}
