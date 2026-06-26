"use client";

import { useEffect } from "react";

// Pings the server every 45s so other users can see this person as "online" (see
// src/lib/clock.ts's isOnline, which treats anyone seen in the last 2 minutes as online).
export function PresenceHeartbeat() {
  useEffect(() => {
    const ping = () => fetch("/api/presence/ping", { method: "POST" }).catch(() => {});
    ping();
    const id = setInterval(ping, 45000);
    return () => clearInterval(id);
  }, []);
  return null;
}
