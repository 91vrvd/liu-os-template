import { assertSameOrigin } from "../../../../../lib/github-auth";
import { runtimeEnv } from "../../../../../lib/runtime";
import {
  cleanNickname,
  cleanupShareSignalData,
  enforceShareMemberRateLimit,
  enforceShareRateLimit,
  getShareRoom,
  insertShareSignal,
  jsonError,
  listShareMembers,
  memberSecretHash,
  readBoundedJson,
  requestMatchesLanNetwork,
  roomResponse,
  touchShareRoom,
  validMemberIdentity,
  validRoomCode,
  validShareSignalPayload,
  verifyShareMember,
} from "../../../../../lib/share-signal";

export const dynamic = "force-dynamic";

const signalTypes = new Set([
  "offer",
  "answer",
  "ice",
  "peer-ready",
  "renegotiate",
  "chat-relay",
]);

interface RouteContext {
  params: Promise<{ code: string }>;
}

interface ActionPayload {
  action?: "join" | "poll" | "signal" | "heartbeat" | "leave" | "approve" | "settings";
  mode?: "private" | "lan";
  memberId?: string;
  memberSecret?: string;
  nickname?: string;
  type?: string;
  toMemberId?: string;
  payload?: unknown;
  nonce?: string;
  targetMemberId?: string;
  approved?: boolean;
  settings?: {
    approvalRequired?: boolean;
    maxMembers?: number;
    fileRecipients?: "selected" | "everyone";
  };
  cursor?: number;
}

const readCode = async (context: RouteContext) => (await context.params).code.trim();

export async function POST(request: Request, context: RouteContext) {
  if (!assertSameOrigin(request)) return jsonError("invalid-origin", 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return jsonError("invalid-content-type", 415);
  }
  if (!await enforceShareRateLimit(request, "room-action-ip", 5_000, 60_000)) {
    return jsonError("too-many-room-actions", 429);
  }
  await cleanupShareSignalData();
  const code = await readCode(context);
  if (!validRoomCode(code)) return jsonError("invalid-room-code", 400);
  const parsed = await readBoundedJson<ActionPayload>(request, 40_960);
  if (parsed.tooLarge) return jsonError("request-too-large", 413);
  const payload = parsed.value;
  if (!payload?.action || !validMemberIdentity(payload.memberId, payload.memberSecret)) {
    return jsonError("invalid-request", 400);
  }
  if (payload.action === "join") {
    if (!await enforceShareRateLimit(request, "room-join", 8, 60_000)) {
      return jsonError("too-many-join-attempts", 429);
    }
    if (!await enforceShareRateLimit(request, `room-join:${code}`, 12, 60_000)) {
      return jsonError("too-many-room-code-attempts", 429);
    }
  }
  const room = await getShareRoom(code);
  if (!room) return jsonError("room-expired", 410);
  if (room.mode === "lan" && !await requestMatchesLanNetwork(request, room.networkHash)) {
    return jsonError(room.networkHash ? "lan-network-mismatch" : "lan-room-upgrade-required", 403);
  }

  if (payload.action === "join") {
    if (payload.mode !== room.mode) return jsonError("room-mode-mismatch", 400);
    const nickname = cleanNickname(payload.nickname);
    if (!nickname) return jsonError("invalid-nickname", 400);
    const existing = await runtimeEnv.DB.prepare(
      "SELECT secret_hash AS secretHash, status FROM share_members WHERE room_code = ? AND member_id = ?",
    ).bind(code, payload.memberId).first<{ secretHash: string; status: "active" | "pending" }>();
    const currentMembers = await listShareMembers(code);
    const occupiedByOtherMembers = currentMembers.filter((member) => (
      member.id !== payload.memberId && member.status !== "offline"
    )).length;
    if (!existing && occupiedByOtherMembers >= room.maxMembers) {
      return jsonError("room-full", 409);
    }
    const expectedHash = await memberSecretHash(code, payload.memberId, payload.memberSecret);
    if (existing && !await verifyShareMember(code, payload.memberId, payload.memberSecret)) {
      return jsonError("member-id-conflict", 409);
    }
    const now = Date.now();
    const status = existing?.status ?? (room.approvalRequired ? "pending" : "active");
    await runtimeEnv.DB.prepare(
      `INSERT INTO share_members
        (id, room_code, member_id, secret_hash, nickname, status, is_host, joined_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(room_code, member_id) DO UPDATE SET
         nickname = excluded.nickname, last_seen_at = excluded.last_seen_at`,
    ).bind(`${code}:${payload.memberId}`, code, payload.memberId, expectedHash, nickname, status, now, now).run();
    await touchShareRoom(code, payload.memberId);
    await insertShareSignal(
      code,
      payload.memberId,
      status === "pending" ? "join-request" : "member-joined",
      {
        id: payload.memberId,
        nickname,
        status,
        isHost: false,
        joinedAt: now,
        lastSeenAt: now,
      },
      status === "pending" ? room.hostMemberId : undefined,
    );
    const updatedRoom = await getShareRoom(code);
    if (!updatedRoom) return jsonError("room-expired", 410);
    return Response.json(await roomResponse(updatedRoom, payload.memberId, status));
  }

  const member = await verifyShareMember(code, payload.memberId, payload.memberSecret);
  if (!member) return jsonError("unauthorized-member", 401);
  const actionLimits: Record<NonNullable<ActionPayload["action"]>, number> = {
    join: 12,
    poll: 120,
    signal: 600,
    heartbeat: 30,
    leave: 15,
    approve: 60,
    settings: 60,
  };
  if (!await enforceShareMemberRateLimit(
    `room-${payload.action}`,
    code,
    payload.memberId,
    actionLimits[payload.action],
    60_000,
  )) return jsonError("too-many-room-actions", 429);

  if (payload.action === "poll") {
    const cursor = Math.max(0, Number(payload.cursor) || 0);
    await touchShareRoom(code, payload.memberId);
    const signals = await runtimeEnv.DB.prepare(
      `SELECT id, type, from_member_id AS fromMemberId, to_member_id AS toMemberId,
        payload_json AS payloadJson, created_at AS createdAt
       FROM share_signals
       WHERE room_code = ? AND id > ? AND from_member_id <> ?
         AND (to_member_id IS NULL OR to_member_id = ?)
       ORDER BY id ASC LIMIT 200`,
    ).bind(code, cursor, payload.memberId, payload.memberId).all<{
      id: number;
      type: string;
      fromMemberId: string;
      toMemberId: string | null;
      payloadJson: string;
      createdAt: number;
    }>();
    const events = signals.results.map((signal) => ({
      id: signal.id,
      type: signal.type,
      fromMemberId: signal.fromMemberId,
      toMemberId: signal.toMemberId ?? undefined,
      payload: JSON.parse(signal.payloadJson) as unknown,
      createdAt: signal.createdAt,
    }));
    return Response.json({
      cursor: events.at(-1)?.id ?? cursor,
      events,
      members: await listShareMembers(code),
      settings: {
        approvalRequired: Boolean(room.approvalRequired),
        maxMembers: room.maxMembers,
        fileRecipients: room.fileRecipients,
      },
      expiresAt: room.expiresAt,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (payload.action === "heartbeat") {
    await touchShareRoom(code, payload.memberId);
    return Response.json({ ok: true });
  }

  if (payload.action === "leave") {
    await runtimeEnv.DB.prepare(
      "UPDATE share_members SET last_seen_at = 0 WHERE room_code = ? AND member_id = ?",
    ).bind(code, payload.memberId).run();
    await insertShareSignal(code, payload.memberId, "member-left", {
      memberId: payload.memberId,
      nickname: member.nickname,
    });
    return Response.json({ ok: true });
  }

  if (member.status !== "active") return jsonError("member-awaiting-approval", 403);

  if (payload.action === "signal") {
    if (!payload.type || !signalTypes.has(payload.type)) return jsonError("invalid-signal-type", 400);
    if (!validShareSignalPayload(payload.type, payload.payload)) return jsonError("invalid-signal-payload", 400);
    if (payload.type === "chat-relay" && room.mode !== "private") {
      return jsonError("relay-not-available-for-lan", 400);
    }
    if (typeof payload.nonce !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(payload.nonce)) {
      return jsonError("invalid-signal-nonce", 400);
    }
    if (payload.toMemberId && !/^[a-zA-Z0-9_-]{8,80}$/.test(payload.toMemberId)) {
      return jsonError("invalid-signal-recipient", 400);
    }
    if (payload.toMemberId) {
      const recipient = await runtimeEnv.DB.prepare(
        "SELECT status FROM share_members WHERE room_code = ? AND member_id = ?",
      ).bind(code, payload.toMemberId).first<{ status: "pending" | "active" }>();
      if (!recipient || recipient.status !== "active") return jsonError("signal-recipient-unavailable", 404);
    }
    try {
      await insertShareSignal(
        code,
        payload.memberId,
        payload.type,
        payload.payload,
        payload.toMemberId,
        payload.nonce,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "signal-failed";
      return jsonError(message, message === "signal-replayed" ? 409 : 400);
    }
    return Response.json({ ok: true });
  }

  if (!member.isHost) return jsonError("host-only-action", 403);

  if (payload.action === "approve") {
    if (!payload.targetMemberId || typeof payload.approved !== "boolean") return jsonError("invalid-approval", 400);
    const target = await runtimeEnv.DB.prepare(
      "SELECT nickname FROM share_members WHERE room_code = ? AND member_id = ?",
    ).bind(code, payload.targetMemberId).first<{ nickname: string }>();
    if (!target) return jsonError("member-not-found", 404);
    if (payload.approved) {
      await runtimeEnv.DB.prepare(
        "UPDATE share_members SET status = 'active' WHERE room_code = ? AND member_id = ?",
      ).bind(code, payload.targetMemberId).run();
    } else {
      await runtimeEnv.DB.prepare(
        "DELETE FROM share_members WHERE room_code = ? AND member_id = ?",
      ).bind(code, payload.targetMemberId).run();
    }
    await insertShareSignal(code, payload.memberId, "approval", { approved: payload.approved }, payload.targetMemberId);
    if (payload.approved) {
      await insertShareSignal(code, payload.targetMemberId, "member-joined", {
        id: payload.targetMemberId,
        nickname: target.nickname,
        status: "active",
        isHost: false,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
      });
    }
    return Response.json({ ok: true });
  }

  if (payload.action === "settings") {
    const settings = payload.settings;
    if (!settings || !["selected", "everyone"].includes(settings.fileRecipients ?? "")) {
      return jsonError("invalid-room-settings", 400);
    }
    const maxLimit = room.mode === "private" ? 8 : 20;
    const maxMembers = Math.max(2, Math.min(maxLimit, Number(settings.maxMembers) || room.maxMembers));
    await runtimeEnv.DB.prepare(
      `UPDATE share_rooms SET approval_required = ?, max_members = ?,
        file_recipients = ?, expires_at = ? WHERE code = ?`,
    ).bind(
      settings.approvalRequired ? 1 : 0,
      maxMembers,
      settings.fileRecipients,
      Date.now() + 60 * 60 * 1000,
      code,
    ).run();
    await insertShareSignal(code, payload.memberId, "room-settings", {
      approvalRequired: Boolean(settings.approvalRequired),
      maxMembers,
      fileRecipients: settings.fileRecipients,
    });
    return Response.json({ ok: true });
  }

  return jsonError("unsupported-action", 400);
}
