import { NextResponse } from "next/server";
import { getContentState, saveDraft } from "../../../../lib/content-store";
import { validateSiteContent } from "../../../../lib/content-validation";
import { assertSameOrigin, readAdminSession } from "../../../../lib/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readAdminSession(request);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const state = await getContentState();
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  const session = await readAdminSession(request);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { content?: unknown } | null;
  const validation = validateSiteContent(payload?.content);
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });
  const draftUpdatedAt = await saveDraft(payload?.content, session.login);
  return NextResponse.json({ ok: true, draftUpdatedAt });
}
