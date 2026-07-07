import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return NextResponse.next();

  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const provided = request.headers.get("x-api-key");
  if (provided !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
