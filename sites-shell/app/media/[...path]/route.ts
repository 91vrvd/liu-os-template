import { runtimeEnv } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const objectKey = path.map((part) => decodeURIComponent(part)).join("/");
  if (!objectKey || objectKey.includes("..")) return new Response("Not found", { status: 404 });
  const object = await runtimeEnv.MEDIA.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
