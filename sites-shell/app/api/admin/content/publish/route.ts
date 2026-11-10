import { NextResponse } from "next/server";
import { publishDraft } from "../../../../../lib/content-store";
import { assertSameOrigin, readAdminSession } from "../../../../../lib/github-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  const session = await readAdminSession(request);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const publishedAt = await publishDraft(session.login);
  if (!publishedAt) return NextResponse.json({ error: "draft-not-found" }, { status: 409 });
  return NextResponse.json({ ok: true, publishedAt });
}
