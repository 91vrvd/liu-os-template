import { assertSameOrigin } from "../../../../lib/github-auth";
import { runtimeEnv } from "../../../../lib/runtime";
import {
  cleanNickname,
  cleanupShareSignalData,
  enforceShareRateLimit,
  getShareRoom,
  jsonError,
  memberSecretHash,
  readBoundedJson,
  requestNetworkHash,
  roomResponse,
  shareTiming,
  validMemberIdentity,
  validRoomCode,
} from "../../../../lib/share-signal";

export const dynamic = "force-dynamic";

interface CreatePayload {
  action?: string;
  mode?: "private" | "lan";
  code?: string;
  memberId?: string;
  memberSecret?: string;
  nickname?: string;
  approvalRequired?: boolean;
  maxMembers?: number;
}

const randomCode = (digits: number) => {
  const max = 10 ** digits;
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % max).padStart(digits, "0");
};

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("invalid-origin", 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return jsonError("invalid-content-type", 415);
  }
  if (!await enforceShareRateLimit(request, "room-create", 20, 60_000)) {
    return jsonError("too-many-room-requests", 429);
  }
  await cleanupShareSignalData();
  const parsed = await readBoundedJson<CreatePayload>(request, 8_192);
  if (parsed.tooLarge) return jsonError("request-too-large", 413);
  const payload = parsed.value;
  if (
    payload?.action !== "create"
    || (payload.mode !== "private" && payload.mode !== "lan")
    || !validMemberIdentity(payload.memberId, payload.memberSecret)
  ) return jsonError("invalid-request", 400);
  const nickname = cleanNickname(payload.nickname);
  if (!nickname) return jsonError("invalid-nickname", 400);

  const digits = payload.mode === "private" ? 4 : 6;
  const requestedCode = payload.code?.trim();
  if (requestedCode && !validRoomCode(requestedCode, payload.mode)) return jsonError("invalid-room-code", 400);
  const maxMembers = Math.max(2, Math.min(payload.mode === "private" ? 8 : 20, Number(payload.maxMembers) || (payload.mode === "private" ? 8 : 20)));
  const now = Date.now();
  const expiresAt = now + shareTiming.roomTtlMs;
  const networkHash = payload.mode === "lan" ? await requestNetworkHash(request) : null;
  if (payload.mode === "lan" && !networkHash) return jsonError("lan-network-unavailable", 400);
  let code = requestedCode ?? "";

  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (!code) code = randomCode(digits);
    const result = await runtimeEnv.DB.prepare(
      `INSERT OR IGNORE INTO share_rooms
        (code, mode, host_member_id, network_hash, approval_required, max_members,
         file_recipients, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'selected', ?, ?)`,
    ).bind(
      code,
      payload.mode,
      payload.memberId,
      networkHash,
      payload.approvalRequired ? 1 : 0,
      maxMembers,
      now,
      expiresAt,
    ).run();
    if (result.meta.changes) break;
    if (requestedCode) return jsonError("room-code-unavailable", 409);
    code = "";
  }
  if (!code) return jsonError("room-code-unavailable", 409);
  const room = await getShareRoom(code);
  if (!room) return jsonError("room-create-failed", 500);
  const secretHash = await memberSecretHash(code, payload.memberId, payload.memberSecret);
  await runtimeEnv.DB.prepare(
    `INSERT INTO share_members
      (id, room_code, member_id, secret_hash, nickname, status, is_host, joined_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
  ).bind(`${code}:${payload.memberId}`, code, payload.memberId, secretHash, nickname, now, now).run();
  return Response.json(await roomResponse(room, payload.memberId, "active"), {
    headers: { "Cache-Control": "no-store" },
  });
}
