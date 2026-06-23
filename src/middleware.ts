import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // Admin panel: CEO only (per spec, CEO grants admin access; ADMIN role is CEO-provisioned)
    if (pathname.startsWith("/admin") && role !== "CEO" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/jobs/:path*",
    "/ceo-dashboard/:path*",
    "/production/:path*",
    "/admin/:path*",
  ],
};
