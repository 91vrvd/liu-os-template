import { runtimeEnv } from "./runtime";

export interface StoredContentState {
  draft: unknown | null;
  published: unknown | null;
  draftUpdatedAt?: string;
  publishedAt?: string;
  updatedBy?: string;
}

let schemaReady: Promise<void> | null = null;

export const ensureContentSchema = async () => {
  if (!schemaReady) {
    schemaReady = runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(`CREATE TABLE IF NOT EXISTS content_state (
        id TEXT PRIMARY KEY NOT NULL,
        draft_json TEXT,
        published_json TEXT,
        draft_updated_at TEXT,
        published_at TEXT,
        updated_by TEXT
      )`),
      runtimeEnv.DB.prepare(`CREATE TABLE IF NOT EXISTS content_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtimeEnv.DB.prepare(`CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY NOT NULL,
        object_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        uploaded_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
    ]).then(() => undefined);
  }
  return schemaReady;
};

const parseJson = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

export const getContentState = async (): Promise<StoredContentState> => {
  await ensureContentSchema();
  const row = await runtimeEnv.DB.prepare(
    "SELECT draft_json, published_json, draft_updated_at, published_at, updated_by FROM content_state WHERE id = ?"
  ).bind("site").first<Record<string, unknown>>();
  if (!row) return { draft: null, published: null };
  return {
    draft: parseJson(row.draft_json),
    published: parseJson(row.published_json),
    draftUpdatedAt: typeof row.draft_updated_at === "string" ? row.draft_updated_at : undefined,
    publishedAt: typeof row.published_at === "string" ? row.published_at : undefined,
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : undefined,
  };
};

export const saveDraft = async (content: unknown, actor: string) => {
  await ensureContentSchema();
  const timestamp = new Date().toISOString();
  const json = JSON.stringify(content);
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(`INSERT INTO content_state (
      id, draft_json, draft_updated_at, updated_by
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      draft_json = excluded.draft_json,
      draft_updated_at = excluded.draft_updated_at,
      updated_by = excluded.updated_by`).bind("site", json, timestamp, actor),
    runtimeEnv.DB.prepare(
      "INSERT INTO content_audit (action, actor, created_at) VALUES (?, ?, ?)"
    ).bind("save-draft", actor, timestamp),
  ]);
  return timestamp;
};

export const publishDraft = async (actor: string) => {
  await ensureContentSchema();
  const current = await runtimeEnv.DB.prepare(
    "SELECT draft_json FROM content_state WHERE id = ?"
  ).bind("site").first<{ draft_json?: string }>();
  if (!current?.draft_json) return null;
  const timestamp = new Date().toISOString();
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(`UPDATE content_state SET
      published_json = draft_json,
      published_at = ?,
      updated_by = ?
      WHERE id = ?`).bind(timestamp, actor, "site"),
    runtimeEnv.DB.prepare(
      "INSERT INTO content_audit (action, actor, created_at) VALUES (?, ?, ?)"
    ).bind("publish", actor, timestamp),
  ]);
  return timestamp;
};
