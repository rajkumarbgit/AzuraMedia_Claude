"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="btn-secondary text-sm"
    >
      <LogOut size={15} />
      Log out
    </button>
  );
}
