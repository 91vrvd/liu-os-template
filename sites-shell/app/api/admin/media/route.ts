import { NextResponse } from "next/server";
import { ensureContentSchema } from "../../../../lib/content-store";
import { assertSameOrigin, readAdminSession } from "../../../../lib/github-auth";
import { runtimeEnv } from "../../../../lib/runtime";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
]);

const safeFileName = (value: string) => value
  .normalize("NFKC")
  .replace(/[^\p{L}\p{N}._-]+/gu, "-")
  .replace(/^\.+/, "")
  .slice(0, 100) || "upload";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  const session = await readAdminSession(request);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "invalid-file" }, { status: 400 });
  }

  await ensureContentSchema();
  const id = crypto.randomUUID();
  const fileName = safeFileName(file.name);
  const objectKey = `${id}/${fileName}`;
  await runtimeEnv.MEDIA.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { uploadedBy: session.login },
  });
  const createdAt = new Date().toISOString();
  await runtimeEnv.DB.prepare(`INSERT INTO media_assets (
    id, object_key, file_name, content_type, size, uploaded_by, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
    id,
    objectKey,
    fileName,
    file.type,
    file.size,
    session.login,
    createdAt
  ).run();

  return NextResponse.json({
    id,
    url: `/media/${id}/${encodeURIComponent(fileName)}`,
    fileName,
    contentType: file.type,
    size: file.size,
  }, { status: 201 });
}
