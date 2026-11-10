import type { ShareMember, ShareMode, ShareRoomSession, ShareRoomSettings } from '../types/share';

export type SignalEventType =
  | 'member-joined'
  | 'member-left'
  | 'join-request'
  | 'approval'
  | 'room-settings'
  | 'offer'
  | 'answer'
  | 'ice'
  | 'peer-ready'
  | 'renegotiate'
  | 'chat-relay';

export interface SignalEvent {
  id: number;
  type: SignalEventType;
  fromMemberId: string;
  toMemberId?: string;
  payload: unknown;
  createdAt: number;
}

interface SignalIdentity {
  memberId: string;
  memberSecret: string;
  nickname: string;
}

interface CreateSignalRoomInput extends SignalIdentity {
  mode: ShareMode;
  code?: string;
  approvalRequired: boolean;
  maxMembers: number;
}

interface JoinSignalRoomInput extends SignalIdentity {
  mode: ShareMode;
  code: string;
}

interface SignalRoomResponse {
  code: string;
  cursor: number;
  hostMemberId: string;
  isHost: boolean;
  status: 'active' | 'pending';
  expiresAt: number;
  members: ShareMember[];
  settings: ShareRoomSettings;
}

interface PollResponse {
  cursor: number;
  events: SignalEvent[];
  members: ShareMember[];
  settings: ShareRoomSettings;
  expiresAt: number;
}

const apiRoot = () => `${window.location.origin}/api/share/rooms`;

class ShareApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ShareApiError';
    this.status = status;
  }
}

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new ShareApiError(payload?.error || `share-api-${response.status}`, response.status);
  if (!payload) throw new Error('share-api-empty-response');
  return payload;
};

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const withTransientRetry = async <T,>(operation: () => Promise<T>) => {
  const delays = [0, 250, 700, 1_500];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await wait(delay);
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const transient = error instanceof ShareApiError
        ? error.status === 429 || error.status >= 500
        : error instanceof TypeError;
      if (!transient) throw error;
    }
  }
  throw lastError;
};

const localRoomKey = (code: string) => `liu-os-local-signal-room:${code}`;
const localEventsKey = (code: string) => `liu-os-local-signal-events:${code}`;

const readLocalEvents = (code: string) => {
  const raw = localStorage.getItem(localEventsKey(code));
  if (!raw) return [] as SignalEvent[];
  try {
    const parsed = JSON.parse(raw) as SignalEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event) => (
      Number.isSafeInteger(event.id)
      && event.id > 0
      && typeof event.type === 'string'
      && typeof event.fromMemberId === 'string'
      && Number.isFinite(event.createdAt)
    )).slice(-500);
  } catch {
    localStorage.removeItem(localEventsKey(code));
    return [];
  }
};

interface LocalRoom {
  code: string;
  mode: ShareMode;
  hostMemberId: string;
  expiresAt: number;
  settings: ShareRoomSettings;
  members: ShareMember[];
}

const isLocalPreview = () => ['localhost', '127.0.0.1'].includes(window.location.hostname);

const readLocalRoom = (code: string): LocalRoom | null => {
  const raw = localStorage.getItem(localRoomKey(code));
  if (!raw) return null;
  try {
    const room = JSON.parse(raw) as LocalRoom;
    if (room.expiresAt <= Date.now()) {
      localStorage.removeItem(localRoomKey(code));
      localStorage.removeItem(localEventsKey(code));
      return null;
    }
    return room;
  } catch {
    localStorage.removeItem(localRoomKey(code));
    return null;
  }
};

const saveLocalRoom = (room: LocalRoom) => localStorage.setItem(localRoomKey(room.code), JSON.stringify(room));

const broadcastLocalEvent = (code: string, event: Omit<SignalEvent, 'id' | 'createdAt'>) => {
  const events = readLocalEvents(code);
  const lastEvent = events[events.length - 1];
  const fullEvent: SignalEvent = {
    ...event,
    id: (lastEvent?.id ?? 0) + 1,
    createdAt: Date.now(),
  };
  localStorage.setItem(localEventsKey(code), JSON.stringify([...events, fullEvent].slice(-500)));
  return fullEvent;
};

const localCreateRoom = (input: CreateSignalRoomInput): SignalRoomResponse => {
  const digits = input.mode === 'private' ? 4 : 6;
  let code = input.code ?? '';
  for (let attempt = 0; attempt < 20 && (!code || readLocalRoom(code)); attempt += 1) {
    code = String(crypto.getRandomValues(new Uint32Array(1))[0] % (10 ** digits)).padStart(digits, '0');
  }
  if (!new RegExp(`^\\d{${digits}}$`).test(code) || readLocalRoom(code)) throw new Error('room-code-unavailable');
  const member: ShareMember = {
    id: input.memberId,
    nickname: input.nickname,
    status: 'active',
    isHost: true,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  const room: LocalRoom = {
    code,
    mode: input.mode,
    hostMemberId: input.memberId,
    expiresAt: Date.now() + 60 * 60 * 1000,
    settings: {
      approvalRequired: input.approvalRequired,
      maxMembers: input.maxMembers,
      fileRecipients: 'selected',
    },
    members: [member],
  };
  localStorage.removeItem(localEventsKey(code));
  saveLocalRoom(room);
  return {
    ...room,
    cursor: 0,
    isHost: true,
    status: 'active',
  };
};

const localJoinRoom = (input: JoinSignalRoomInput): SignalRoomResponse => {
  const room = readLocalRoom(input.code);
  if (!room || room.mode !== input.mode) throw new Error('room-not-found');
  if (room.members.filter((member) => member.status === 'active').length >= room.settings.maxMembers) {
    throw new Error('room-full');
  }
  const member: ShareMember = {
    id: input.memberId,
    nickname: input.nickname,
    status: room.settings.approvalRequired ? 'pending' : 'active',
    isHost: false,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  room.members = [...room.members.filter((item) => item.id !== member.id), member];
  room.expiresAt = Date.now() + 60 * 60 * 1000;
  saveLocalRoom(room);
  const joinedEvent = broadcastLocalEvent(room.code, {
    type: room.settings.approvalRequired ? 'join-request' : 'member-joined',
    fromMemberId: member.id,
    toMemberId: room.settings.approvalRequired ? room.hostMemberId : undefined,
    payload: member,
  });
  return {
    ...room,
    cursor: joinedEvent.id,
    isHost: false,
    status: member.status === 'pending' ? 'pending' : 'active',
  };
};

export const createSignalRoom = async (input: CreateSignalRoomInput): Promise<SignalRoomResponse> => {
  if (isLocalPreview()) return localCreateRoom(input);
  return fetchJson<SignalRoomResponse>(apiRoot(), {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...input }),
  });
};

export const joinSignalRoom = async (input: JoinSignalRoomInput): Promise<SignalRoomResponse> => {
  if (isLocalPreview()) return localJoinRoom(input);
  return fetchJson<SignalRoomResponse>(`${apiRoot()}/${encodeURIComponent(input.code)}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'join', ...input }),
  });
};

const authPayload = (session: ShareRoomSession) => ({
  memberId: session.memberId,
  memberSecret: session.memberSecret,
});

export const sendSignalEvent = async (
  session: ShareRoomSession,
  type: SignalEventType,
  payload: unknown,
  toMemberId?: string,
) => {
  if (isLocalPreview()) {
    broadcastLocalEvent(session.code, {
      type,
      fromMemberId: session.memberId,
      toMemberId,
      payload,
    });
    return;
  }
  const nonce = crypto.randomUUID();
  await withTransientRetry(() => fetchJson<{ ok: true }>(
    `${apiRoot()}/${encodeURIComponent(session.code)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'signal',
        ...authPayload(session),
        type,
        toMemberId,
        payload,
        nonce,
      }),
    },
  ));
};

export const pollSignalEvents = async (session: ShareRoomSession, cursor: number): Promise<PollResponse> => {
  if (isLocalPreview()) {
    const room = readLocalRoom(session.code);
    if (!room) throw new Error('room-expired');
    const events = readLocalEvents(session.code).filter((event) => (
      event.id > cursor
      && event.fromMemberId !== session.memberId
      && (!event.toMemberId || event.toMemberId === session.memberId)
    ));
    const nextCursor = Math.max(cursor, ...events.map((event) => event.id), 0);
    return {
      cursor: nextCursor,
      events,
      members: room.members,
      settings: room.settings,
      expiresAt: room.expiresAt,
    };
  }
  return fetchJson<PollResponse>(`${apiRoot()}/${encodeURIComponent(session.code)}`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'poll',
      ...authPayload(session),
      cursor,
    }),
  });
};

export const heartbeatSignalRoom = async (session: ShareRoomSession) => {
  if (isLocalPreview()) {
    const room = readLocalRoom(session.code);
    if (!room) throw new Error('room-expired');
    room.members = room.members.map((member) => member.id === session.memberId
      ? { ...member, status: 'active', lastSeenAt: Date.now() }
      : member);
    room.expiresAt = Date.now() + 60 * 60 * 1000;
    saveLocalRoom(room);
    return;
  }
  await fetchJson<{ ok: true }>(`${apiRoot()}/${encodeURIComponent(session.code)}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'heartbeat', ...authPayload(session) }),
  });
};

export const leaveSignalRoom = async (session: ShareRoomSession) => {
  if (isLocalPreview()) {
    const room = readLocalRoom(session.code);
    if (!room) return;
    room.members = room.members.map((member) => member.id === session.memberId
      ? { ...member, status: 'offline', lastSeenAt: 0 }
      : member);
    room.expiresAt = Date.now() + 60 * 60 * 1000;
    saveLocalRoom(room);
    broadcastLocalEvent(room.code, {
      type: 'member-left',
      fromMemberId: session.memberId,
      payload: { memberId: session.memberId, nickname: session.nickname },
    });
    return;
  }
  await fetchJson<{ ok: true }>(`${apiRoot()}/${encodeURIComponent(session.code)}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'leave', ...authPayload(session) }),
  });
};

export const approveSignalMember = async (session: ShareRoomSession, memberId: string, approved: boolean) => {
  if (isLocalPreview()) {
    const room = readLocalRoom(session.code);
    if (!room || room.hostMemberId !== session.memberId) throw new Error('forbidden');
    room.members = approved
      ? room.members.map((member) => member.id === memberId ? { ...member, status: 'active' } : member)
      : room.members.filter((member) => member.id !== memberId);
    saveLocalRoom(room);
    broadcastLocalEvent(room.code, {
      type: 'approval',
      fromMemberId: session.memberId,
      toMemberId: memberId,
      payload: { approved },
    });
    if (approved) {
      const member = room.members.find((item) => item.id === memberId);
      if (member) broadcastLocalEvent(room.code, { type: 'member-joined', fromMemberId: memberId, payload: member });
    }
    return;
  }
  await fetchJson<{ ok: true }>(`${apiRoot()}/${encodeURIComponent(session.code)}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve', ...authPayload(session), targetMemberId: memberId, approved }),
  });
};

export const updateSignalRoomSettings = async (session: ShareRoomSession, settings: ShareRoomSettings) => {
  if (isLocalPreview()) {
    const room = readLocalRoom(session.code);
    if (!room || room.hostMemberId !== session.memberId) throw new Error('forbidden');
    room.settings = settings;
    saveLocalRoom(room);
    broadcastLocalEvent(room.code, {
      type: 'room-settings',
      fromMemberId: session.memberId,
      payload: settings,
    });
    return;
  }
  await fetchJson<{ ok: true }>(`${apiRoot()}/${encodeURIComponent(session.code)}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'settings', ...authPayload(session), settings }),
  });
};
