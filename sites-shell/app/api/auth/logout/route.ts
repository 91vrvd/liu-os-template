import { NextResponse } from "next/server";
import { authCookies, clearCookie } from "../../../../lib/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/desktop/?admin=1", request.url));
  response.headers.append("Set-Cookie", clearCookie(authCookies.session, request));
  return response;
}
