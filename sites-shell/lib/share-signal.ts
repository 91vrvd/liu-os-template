import { runtimeEnv } from "./runtime";
import { trustedClientAddress, trustedClientNetwork } from "./trusted-proxy";

const encoder = new TextEncoder();
const ROOM_TTL_MS = 60 * 60 * 1000;
const SIGNAL_TTL_MS = 5 * 60 * 1000;

export const shareTiming = {
  roomTtlMs: ROOM_TTL_MS,
  signalTtlMs: SIGNAL_TTL_MS,
};

export const jsonError = (error: string, status: number) => Response.json(
  { error },
  { status, headers: { "Cache-Control": "no-store" } },
);

export const readBoundedJson = async <T,>(request: Request, maxBytes: number) => {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) return { value: null, tooLarge: true };
  if (!request.body) return { value: null, tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("request-too-large").catch(() => undefined);
      return { value: null, tooLarge: true };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });
  try {
    return {
      value: JSON.parse(new TextDecoder().decode(body)) as T,
      tooLarge: false,
    };
  } catch {
    return { value: null, tooLarge: false };
  }
};

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const digest = async (value: string) => {
  const secret = runtimeEnv.AUTH_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
};

export const memberSecretHash = (roomCode: string, memberId: string, secret: string) => (
  digest(`${roomCode}:${memberId}:${secret}`)
);

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
};

export const validMemberIdentity = (memberId: unknown, memberSecret: unknown) => (
  typeof memberId === "string"
  && /^[a-zA-Z0-9_-]{8,80}$/.test(memberId)
  && typeof memberSecret === "string"
  && /^[a-zA-Z0-9_-]{20,160}$/.test(memberSecret)
);

export const cleanNickname = (value: unknown) => {
  if (typeof value !== "string") return "";
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, 32);
};

export const validRoomCode = (value: unknown, mode?: "private" | "lan") => {
  if (typeof value !== "string") return false;
  if (mode === "private") return /^\d{4}$/.test(value);
  if (mode === "lan") return /^\d{6}$/.test(value);
  return /^\d{4}$|^\d{6}$/.test(value);
};

export const requestNetworkHash = async (request: Request) => {
  const network = await trustedClientNetwork(request);
  return network ? digest(`lan-network:${network}`) : null;
};

export const requestMatchesLanNetwork = async (request: Request, expectedHash: string | null) => {
  if (!expectedHash) return false;
  const actualHash = await requestNetworkHash(request);
  return actualHash ? safeEqual(actualHash, expectedHash) : false;
};

const enforceShareRateLimitValue = async (
  action: string,
  identity: string,
  limit: number,
  windowMs: number,
) => {
  const now = Date.now();
  const key = await digest(`${action}:${identity}`);
  const db = runtimeEnv.DB;
  const row = await db.prepare(
    "SELECT count, window_started_at AS windowStartedAt FROM share_rate_limits WHERE key = ?",
  ).bind(key).first<{ count: number; windowStartedAt: number }>();
  const isNewWindow = !row || now - row.windowStartedAt >= windowMs;
  const nextCount = isNewWindow ? 1 : row.count + 1;
  const windowStartedAt = isNewWindow ? now : row.windowStartedAt;
  await db.prepare(
    `INSERT INTO share_rate_limits (key, count, window_started_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET count = excluded.count,
       window_started_at = excluded.window_started_at,
       expires_at = excluded.expires_at`,
  ).bind(key, nextCount, windowStartedAt, windowStartedAt + windowMs).run();
  return nextCount <= limit;
};

export const enforceShareRateLimit = async (
  request: Request,
  action: string,
  limit: number,
  windowMs: number,
) => enforceShareRateLimitValue(
  action,
  await trustedClientAddress(request) ?? "unknown",
  limit,
  windowMs,
);

export const enforceShareMemberRateLimit = (
  action: string,
  roomCode: string,
  memberId: string,
  limit: number,
  windowMs: number,
) => enforceShareRateLimitValue(action, `${roomCode}:${memberId}`, limit, windowMs);

export const cleanupShareSignalData = async () => {
  const now = Date.now();
  const db = runtimeEnv.DB;
  await db.batch([
    db.prepare("DELETE FROM share_signals WHERE expires_at < ?").bind(now),
    db.prepare("DELETE FROM share_rate_limits WHERE expires_at < ?").bind(now),
    db.prepare("DELETE FROM share_rooms WHERE expires_at < ?").bind(now),
  ]);
};

export interface ShareRoomRow {
  code: string;
  mode: "private" | "lan";
  hostMemberId: string;
  networkHash: string | null;
  approvalRequired: number;
  maxMembers: number;
  fileRecipients: "selected" | "everyone";
  createdAt: number;
  expiresAt: number;
}

export interface ShareMemberRow {
  id: string;
  roomCode: string;
  memberId: string;
  secretHash: string;
  nickname: string;
  status: "pending" | "active";
  isHost: number;
  joinedAt: number;
  lastSeenAt: number;
}

export const getShareRoom = (code: string) => runtimeEnv.DB.prepare(
  `SELECT code, mode, host_member_id AS hostMemberId,
    network_hash AS networkHash,
    approval_required AS approvalRequired, max_members AS maxMembers,
    file_recipients AS fileRecipients, created_at AS createdAt, expires_at AS expiresAt
   FROM share_rooms WHERE code = ?`,
).bind(code).first<ShareRoomRow>();

export const listShareMembers = async (code: string) => {
  const result = await runtimeEnv.DB.prepare(
    `SELECT id, room_code AS roomCode, member_id AS memberId, secret_hash AS secretHash,
      nickname, status, is_host AS isHost, joined_at AS joinedAt, last_seen_at AS lastSeenAt
     FROM share_members WHERE room_code = ? ORDER BY joined_at ASC`,
  ).bind(code).all<ShareMemberRow>();
  const now = Date.now();
  return result.results.map((member) => ({
    id: member.memberId,
    nickname: member.nickname,
    status: member.status === "active" && now - member.lastSeenAt > 25_000 ? "offline" : member.status,
    isHost: Boolean(member.isHost),
    joinedAt: member.joinedAt,
    lastSeenAt: member.lastSeenAt,
  }));
};

export const verifyShareMember = async (code: string, memberId: string, memberSecret: string) => {
  const member = await runtimeEnv.DB.prepare(
    `SELECT id, room_code AS roomCode, member_id AS memberId, secret_hash AS secretHash,
      nickname, status, is_host AS isHost, joined_at AS joinedAt, last_seen_at AS lastSeenAt
     FROM share_members WHERE room_code = ? AND member_id = ?`,
  ).bind(code, memberId).first<ShareMemberRow>();
  if (!member) return null;
  const expected = await memberSecretHash(code, memberId, memberSecret);
  return safeEqual(expected, member.secretHash) ? member : null;
};

export const roomResponse = async (room: ShareRoomRow, memberId: string, status: "active" | "pending") => ({
  code: room.code,
  cursor: Number((await runtimeEnv.DB.prepare(
    "SELECT COALESCE(MAX(id), 0) AS cursor FROM share_signals WHERE room_code = ?",
  ).bind(room.code).first<{ cursor: number }>())?.cursor ?? 0),
  hostMemberId: room.hostMemberId,
  isHost: room.hostMemberId === memberId,
  status,
  expiresAt: room.expiresAt,
  members: await listShareMembers(room.code),
  settings: {
    approvalRequired: Boolean(room.approvalRequired),
    maxMembers: room.maxMembers,
    fileRecipients: room.fileRecipients,
  },
});

export const insertShareSignal = async (
  code: string,
  fromMemberId: string,
  type: string,
  payload: unknown,
  toMemberId?: string,
  nonce = crypto.randomUUID(),
) => {
  const now = Date.now();
  const payloadJson = JSON.stringify(payload ?? null);
  if (payloadJson.length > 36_000) throw new Error("signal-payload-too-large");
  const result = await runtimeEnv.DB.prepare(
    `INSERT OR IGNORE INTO share_signals
      (room_code, from_member_id, to_member_id, type, payload_json, nonce, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(code, fromMemberId, toMemberId ?? null, type, payloadJson, nonce, now, now + SIGNAL_TTL_MS).run();
  if (!result.meta.changes) throw new Error("signal-replayed");
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

export const validShareSignalPayload = (type: string, payload: unknown) => {
  if (!isRecord(payload)) return false;
  if (type === "peer-ready" || type === "renegotiate") {
    return Object.keys(payload).length <= 2;
  }
  if (type === "chat-relay") {
    return (
      payload.algorithm === "a256gcm-pbkdf2-v1"
      && typeof payload.iv === "string"
      && /^[a-zA-Z0-9_-]{16,32}$/.test(payload.iv)
      && typeof payload.ciphertext === "string"
      && /^[a-zA-Z0-9_-]{24,34000}$/.test(payload.ciphertext)
    );
  }
  if (type === "offer" || type === "answer") {
    return (
      payload.type === type
      && typeof payload.sdp === "string"
      && payload.sdp.length > 0
      && payload.sdp.length <= 22_000
    );
  }
  if (type === "ice") {
    return (
      typeof payload.candidate === "string"
      && payload.candidate.length <= 4_000
      && (payload.sdpMid === null || payload.sdpMid === undefined || typeof payload.sdpMid === "string")
      && (
        payload.sdpMLineIndex === null
        || payload.sdpMLineIndex === undefined
        || (
          typeof payload.sdpMLineIndex === "number"
          && Number.isInteger(payload.sdpMLineIndex)
          && payload.sdpMLineIndex >= 0
          && payload.sdpMLineIndex <= 64
        )
      )
    );
  }
  return false;
};

export const touchShareRoom = async (code: string, memberId: string) => {
  const now = Date.now();
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(
      "UPDATE share_members SET last_seen_at = ? WHERE room_code = ? AND member_id = ?",
    ).bind(now, code, memberId),
    runtimeEnv.DB.prepare(
      "UPDATE share_rooms SET expires_at = ? WHERE code = ?",
    ).bind(now + ROOM_TTL_MS, code),
  ]);
};
