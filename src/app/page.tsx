import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { defaultDashboardPath } from "@/lib/permissions";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  redirect(defaultDashboardPath(session.user.role));
}
