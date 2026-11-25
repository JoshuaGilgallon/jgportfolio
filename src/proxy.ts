import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Optimistic gate for /admin. Every admin page and Server Action re-checks
 * the session itself (see lib/session.ts); this only saves a round trip.
 */
export default auth((req) => {
  const isLogin = req.nextUrl.pathname === "/admin/login";
  if (!req.auth && !isLogin) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
  }
  if (req.auth && isLogin) {
    return NextResponse.redirect(new URL("/admin/posts", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
