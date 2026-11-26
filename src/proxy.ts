import { NextResponse } from "next/server";
import { auth } from "@/auth";

// just an early redirect, pages and actions check again
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
