import { NextResponse } from "next/server";
import { getContentState } from "../../../lib/content-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getContentState();
  return NextResponse.json({
    content: state.published,
    publishedAt: state.publishedAt ?? null,
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
    },
  });
}
