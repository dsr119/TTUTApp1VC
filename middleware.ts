import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: bounce visitors with no session cookie to the sign-in page.
// Each page still validates the session against the database.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("ct_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/|icon.svg|manifest.webmanifest|favicon.ico).*)"],
};
