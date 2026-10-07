import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/students", req.nextUrl));
  }
});

export const config = {
  // Everything except static assets, the auth API routes themselves, and
  // the public import template file.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|templates).*)"],
};
