import { NextResponse } from "next/server";
import { readAdminSession } from "../../../../lib/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readAdminSession(request);
  return NextResponse.json(session
    ? { authenticated: true, authorized: true, login: session.login, avatarUrl: session.avatarUrl }
    : { authenticated: false, authorized: false }, {
    headers: { "Cache-Control": "no-store" },
  });
}
