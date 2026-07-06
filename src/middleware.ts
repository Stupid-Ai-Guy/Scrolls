import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const USER_PROTECTED = ["/dashboard", "/lessons", "/blogs"];
const ADMIN_PROTECTED = ["/admin"];

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? "";
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsUser = USER_PROTECTED.some((p) => pathname.startsWith(p));
  const needsAdmin = ADMIN_PROTECTED.some((p) => pathname.startsWith(p));
  if (!needsUser && !needsAdmin) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (needsAdmin && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/lessons/:path*",
    "/blogs/:path*",
  ],
};
