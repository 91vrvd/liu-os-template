import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  approveSignalMember,
  createSignalRoom,
  heartbeatSignalRoom,
  joinSignalRoom,
  leaveSignalRoom,
  pollSignalEvents,
  sendSignalEvent,
  type SignalEvent,
  updateSignalRoomSettings,
} from '../lib/shareSignalClient';
import {
  classifySharePreview,
  cleanupExpiredInbox,
  clearShareMessages,
  createOpfsWriter,
  deleteInboxItem,
  fileFingerprint,
  getOpfsFile,
  getShareBlob,
  hasStorageFor,
  inboxExpiryFor,
  listInboxItems,
  listShareMessages,
  listShareTransfers,
  saveInboxItem,
  saveShareMessage,
  saveShareTransfer,
  sanitizeShareFileName,
  setInboxPinned,
} from '../lib/shareStore';
import type {
  LiuNotification,
  ShareFileDescriptor,
  ShareInboxItem,
  ShareMember,
  ShareMessage,
  ShareMode,
  ShareRoomCreateOptions,
  ShareRoomJoinOptions,
  ShareRoomSession,
  ShareRoomSettings,
  ShareTransfer,
  ShareTransferStatus,
} from '../types/share';

const CHUNK_BYTES = 64 * 1024;
const BUFFER_HIGH_WATER = 4 * 1024 * 1024;
const MEMORY_FALLBACK_LIMIT = 512 * 1024 * 1024;
const LEGACY_SESSION_STORAGE_KEYS = [
  'liu-os-share-sessions-v1',
  'liu-os-share-sessions-v2',
  'liu-os-share-sessions-v3',
  'liu-os-share-sessions-v4',
];
const SESSION_STORAGE_KEY = 'liu-os-share-sessions-v5';
const NICKNAME_STORAGE_KEY = 'liu-os-share-nickname';

type WireMessage =
  | { v: 1; type: 'chat'; message: ShareMessage }
  | { v: 1; type: 'file-offer'; transfer: ShareTransfer }
  | { v: 1; type: 'file-accept'; transferId: string; offset: number }
  | { v: 1; type: 'file-reject'; transferId: string }
  | { v: 1; type: 'file-control'; transferId: string; action: 'pause' | 'cancel' }
  | { v: 1; type: 'chunk-header'; transferId: string; offset: number; length: number }
  | { v: 1; type: 'file-complete'; transferId: string }
  | { v: 1; type: 'file-received'; transferId: string };

interface PeerRuntime {
  mode: ShareMode;
  peerId: string;
  connection: RTCPeerConnection;
  channel: RTCDataChannel | null;
  pathVerified: boolean;
  pendingChunk: { transferId: string; offset: number; length: number } | null;
  pendingIce: RTCIceCandidateInit[];
  processing: Promise<void>;
}

interface ReceiverRuntime {
  writer: FileSystemWritableFileStream | null;
  opfsName?: string;
  chunks: Uint8Array[];
  nextOffset: number;
}

interface ShareContextValue {
  sessions: Partial<Record<ShareMode, ShareRoomSession>>;
  connectedPeers: Record<ShareMode, string[]>;
  messages: Record<string, ShareMessage[]>;
  transfers: ShareTransfer[];
  inbox: ShareInboxItem[];
  notifications: LiuNotification[];
  nickname: string;
  setNickname: (nickname: string) => void;
  createRoom: (mode: ShareMode, options: ShareRoomCreateOptions) => Promise<void>;
  joinRoom: (mode: ShareMode, options: ShareRoomJoinOptions) => Promise<void>;
  leaveRoom: (mode: ShareMode, force?: boolean) => Promise<boolean>;
  sendText: (mode: ShareMode, text: string) => Promise<void>;
  sendFiles: (mode: ShareMode, files: File[], recipients: string[]) => Promise<void>;
  acceptTransfer: (transferId: string) => Promise<void>;
  rejectTransfer: (transferId: string) => void;
  pauseTransfer: (transferId: string) => void;
  resumeTransfer: (transferId: string) => void;
  cancelTransfer: (transferId: string) => void;
  retryTransfer: (transferId: string) => void;
  reselectTransferSource: (transferId: string, file: File) => Promise<boolean>;
  approveMember: (mode: ShareMode, memberId: string, approved: boolean) => Promise<void>;
  updateRoomSettings: (mode: ShareMode, settings: ShareRoomSettings) => Promise<void>;
  requestBrowserNotifications: () => Promise<NotificationPermission | 'unsupported'>;
  dismissNotification: (id: string) => void;
  markNotificationsRead: (appId?: LiuNotification['appId']) => void;
  badgeCount: (appId: 'privateShare' | 'lanShare' | 'transferCenter') => number;
  downloadInboxItem: (item: ShareInboxItem) => Promise<void>;
  removeInboxItem: (item: ShareInboxItem) => Promise<void>;
  pinInboxItem: (item: ShareInboxItem, pinned: boolean) => Promise<void>;
  clearRoomHistory: (roomCode: string) => Promise<void>;
  getInboxBlob: (item: ShareInboxItem) => Promise<File | null>;
}

const ShareContext = createContext<ShareContextValue | null>(null);

const randomToken = (bytes = 24) => {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values).map((value) => value.toString(36).padStart(2, '0')).join('').slice(0, bytes * 2);
};

const makeIdentity = () => ({
  memberId: `member_${randomToken(18)}`,
  memberSecret: randomToken(36),
});

const connectionKey = (mode: ShareMode, peerId: string) => `${mode}:${peerId}`;
const sessionKey = (session: ShareRoomSession) => (
  `${session.mode}:${session.code}:${session.memberId}`
);
const shouldInitiatePeer = (memberId: string, peerId: string) => (
  memberId.localeCompare(peerId) < 0
);

const relayKeyCache = new Map<string, Promise<CryptoKey>>();
const relayEncoder = new TextEncoder();
const relayDecoder = new TextDecoder();

const toBase64Url = (value: Uint8Array) => {
  let binary = '';
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const relayKeyFor = (roomCode: string) => {
  const cached = relayKeyCache.get(roomCode);
  if (cached) return cached;
  const key = (async () => {
    const material = await crypto.subtle.importKey(
      'raw',
      relayEncoder.encode(roomCode),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 120_000,
        salt: relayEncoder.encode(`liu-os-private-relay-v1:${roomCode}`),
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  })();
  relayKeyCache.set(roomCode, key);
  return key;
};

interface EncryptedRelayPayload {
  algorithm: 'a256gcm-pbkdf2-v1';
  iv: string;
  ciphertext: string;
}

const encryptRelayMessage = async (
  roomCode: string,
  message: ShareMessage,
): Promise<EncryptedRelayPayload> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await relayKeyFor(roomCode),
    relayEncoder.encode(JSON.stringify(message)),
  );
  return {
    algorithm: 'a256gcm-pbkdf2-v1',
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(new Uint8Array(encrypted)),
  };
};

const decryptRelayMessage = async (
  roomCode: string,
  payload: unknown,
): Promise<ShareMessage | null> => {
  if (
    !isRecord(payload)
    || payload.algorithm !== 'a256gcm-pbkdf2-v1'
    || typeof payload.iv !== 'string'
    || typeof payload.ciphertext !== 'string'
  ) return null;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(payload.iv) },
      await relayKeyFor(roomCode),
      fromBase64Url(payload.ciphertext),
    );
    const parsed = JSON.parse(relayDecoder.decode(decrypted)) as unknown;
    const wire = parseWireMessage(JSON.stringify({ v: 1, type: 'chat', message: parsed }));
    return wire?.type === 'chat' ? wire.message : null;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isWireId = (value: unknown) => (
  typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value)
);

const isSafeByteCount = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 0
);

const isFileDescriptor = (value: unknown): value is ShareFileDescriptor => {
  if (!isRecord(value)) return false;
  return (
    isWireId(value.id)
    && isWireId(value.transferId)
    && typeof value.name === 'string'
    && value.name.length > 0
    && value.name.length <= 180
    && typeof value.type === 'string'
    && value.type.length <= 180
    && isSafeByteCount(value.size)
    && isSafeByteCount(value.lastModified)
    && typeof value.fingerprint === 'string'
    && /^[a-f0-9]{64}$/.test(value.fingerprint)
    && isWireId(value.senderId)
    && typeof value.senderName === 'string'
    && value.senderName.length > 0
    && value.senderName.length <= 32
  );
};

const parseWireMessage = (value: string): WireMessage | null => {
  if (value.length > 64_000) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed) || parsed.v !== 1 || typeof parsed.type !== 'string') return null;
    if (parsed.type === 'chat') {
      const message = parsed.message;
      if (!isRecord(message)) return null;
      if (
        !isWireId(message.id)
        || typeof message.roomCode !== 'string'
        || !/^\d{4}$|^\d{6}$/.test(message.roomCode)
        || !isWireId(message.senderId)
        || typeof message.senderName !== 'string'
        || message.senderName.length < 1
        || message.senderName.length > 32
        || (message.kind !== 'text' && message.kind !== 'link')
        || typeof message.text !== 'string'
        || message.text.length < 1
        || message.text.length > 20_000
        || !isSafeByteCount(message.createdAt)
      ) return null;
      return parsed as unknown as WireMessage;
    }
    if (parsed.type === 'file-offer') {
      const transfer = parsed.transfer;
      if (!isRecord(transfer) || !isFileDescriptor(transfer.file)) return null;
      if (
        !isWireId(transfer.id)
        || transfer.id !== transfer.file.transferId
        || typeof transfer.roomCode !== 'string'
        || !/^\d{4}$|^\d{6}$/.test(transfer.roomCode)
        || (transfer.mode !== 'private' && transfer.mode !== 'lan')
        || transfer.direction !== 'send'
        || !isWireId(transfer.peerId)
        || typeof transfer.peerName !== 'string'
        || transfer.peerName.length > 32
        || !isSafeByteCount(transfer.transferredBytes)
        || transfer.transferredBytes > transfer.file.size
      ) return null;
      return parsed as unknown as WireMessage;
    }
    if (
      parsed.type === 'file-reject'
      || parsed.type === 'file-complete'
      || parsed.type === 'file-received'
    ) {
      return isWireId(parsed.transferId) ? parsed as unknown as WireMessage : null;
    }
    if (parsed.type === 'file-control') {
      return isWireId(parsed.transferId) && (parsed.action === 'pause' || parsed.action === 'cancel')
        ? parsed as unknown as WireMessage
        : null;
    }
    if (parsed.type === 'file-accept') {
      return isWireId(parsed.transferId) && isSafeByteCount(parsed.offset)
        ? parsed as unknown as WireMessage
        : null;
    }
    if (parsed.type === 'chunk-header') {
      return (
        isWireId(parsed.transferId)
        && isSafeByteCount(parsed.offset)
        && isSafeByteCount(parsed.length)
        && parsed.length > 0
        && parsed.length <= CHUNK_BYTES
      ) ? parsed as unknown as WireMessage : null;
    }
    return null;
  } catch {
    return null;
  }
};

const saveSessions = (sessions: Partial<Record<ShareMode, ShareRoomSession>>) => {
  try {
    const now = Date.now();
    const serializable = Object.fromEntries(
      Object.entries(sessions).filter(([, session]) => session && session.expiresAt > now),
    );
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializable));
    LEGACY_SESSION_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch {
    // Private browsing modes may deny storage; the in-memory room remains usable.
  }
};

const loadSessions = (): Partial<Record<ShareMode, ShareRoomSession>> => {
  try {
    LEGACY_SESSION_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}') as Partial<Record<ShareMode, ShareRoomSession>>;
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed).filter(([, session]) => (
        session
        && Number.isSafeInteger(session.signalCursor)
        && session.signalCursor >= 0
        && session.expiresAt > now
      )),
    ) as Partial<Record<ShareMode, ShareRoomSession>>;
  } catch {
    return {};
  }
};

const messageKindForFile = (file: File): ShareMessage['kind'] => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
};

const localized = (zh: string, en: string) => (
  typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? en : zh
);

const isActiveTransfer = (status: ShareTransferStatus) => (
  status === 'queued'
  || status === 'connecting'
  || status === 'transferring'
  || status === 'pending'
);

const waitForChannelCapacity = (channel: RTCDataChannel) => new Promise<void>((resolve, reject) => {
  if (channel.readyState !== 'open') {
    reject(new Error('peer-channel-closed'));
    return;
  }
  if (channel.bufferedAmount < BUFFER_HIGH_WATER) {
    resolve();
    return;
  }
  channel.bufferedAmountLowThreshold = BUFFER_HIGH_WATER / 2;
  const onLow = () => {
    channel.removeEventListener('bufferedamountlow', onLow);
    resolve();
  };
  channel.addEventListener('bufferedamountlow', onLow, { once: true });
  window.setTimeout(() => {
    channel.removeEventListener('bufferedamountlow', onLow);
    if (channel.readyState === 'open') resolve();
    else reject(new Error('peer-channel-closed'));
  }, 10_000);
});

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeShareFileName(name);
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
};

export const ShareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Partial<Record<ShareMode, ShareRoomSession>>>(loadSessions);
  const [connectedPeers, setConnectedPeers] = useState<Record<ShareMode, string[]>>({
    private: [],
    lan: [],
  });
  const [messages, setMessages] = useState<Record<string, ShareMessage[]>>({});
  const [transfers, setTransfers] = useState<ShareTransfer[]>([]);
  const [inbox, setInbox] = useState<ShareInboxItem[]>([]);
  const [notifications, setNotifications] = useState<LiuNotification[]>([]);
  const [nickname, setNicknameState] = useState(() => localStorage.getItem(NICKNAME_STORAGE_KEY) || 'Liu OS 用户');

  const sessionsRef = useRef(sessions);
  const transfersRef = useRef(transfers);
  const peersRef = useRef(new Map<string, PeerRuntime>());
  const cursorsRef = useRef(new Map<string, number>());
  const announcedPeersRef = useRef(new Set<string>());
  const sourceFilesRef = useRef(new Map<string, File>());
  const receiverRef = useRef(new Map<string, ReceiverRuntime>());
  const browserNotificationAskedRef = useRef(false);
  const pendingProgressRef = useRef(new Map<string, { bytes: number; at: number }>());

  useEffect(() => {
    sessionsRef.current = sessions;
    saveSessions(sessions);
  }, [sessions]);

  const updateSessions = useCallback((
    updater: (
      current: Partial<Record<ShareMode, ShareRoomSession>>,
    ) => Partial<Record<ShareMode, ShareRoomSession>>,
  ) => {
    const next = updater(sessionsRef.current);
    sessionsRef.current = next;
    setSessions(next);
  }, []);

  const setPeerConnected = useCallback((mode: ShareMode, peerId: string, connected: boolean) => {
    setConnectedPeers((current) => {
      const peers = current[mode];
      const nextPeers = connected
        ? [...new Set([...peers, peerId])]
        : peers.filter((id) => id !== peerId);
      if (nextPeers.length === peers.length && nextPeers.every((id, index) => id === peers[index])) {
        return current;
      }
      return { ...current, [mode]: nextPeers };
    });
  }, []);

  const resetModeRuntime = useCallback((mode: ShareMode) => {
    Array.from(peersRef.current.entries()).forEach(([key, peer]) => {
      if (peer.mode !== mode) return;
      peer.connection.close();
      peersRef.current.delete(key);
    });
    Array.from(announcedPeersRef.current).forEach((key) => {
      if (key.startsWith(`${mode}:`)) announcedPeersRef.current.delete(key);
    });
    setConnectedPeers((current) => (
      current[mode].length ? { ...current, [mode]: [] } : current
    ));
  }, []);

  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  const setNickname = useCallback((value: string) => {
    const clean = Array.from(value)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code > 31 && code !== 127;
      })
      .join('')
      .trim()
      .slice(0, 32) || 'Liu OS 用户';
    setNicknameState(clean);
    localStorage.setItem(NICKNAME_STORAGE_KEY, clean);
  }, []);

  const updateTransfer = useCallback((id: string, patch: Partial<ShareTransfer>) => {
    setTransfers((current) => {
      const next = current.map((transfer) => transfer.id === id ? {
        ...transfer,
        ...patch,
        updatedAt: Date.now(),
      } : transfer);
      const updated = next.find((transfer) => transfer.id === id);
      if (updated) void saveShareTransfer(updated);
      transfersRef.current = next;
      return next;
    });
  }, []);

  const addTransfer = useCallback((transfer: ShareTransfer) => {
    setTransfers((current) => {
      const next = [transfer, ...current.filter((item) => item.id !== transfer.id)].slice(0, 200);
      void saveShareTransfer(transfer);
      transfersRef.current = next;
      return next;
    });
  }, []);

  const notify = useCallback((
    notification: Omit<LiuNotification, 'id' | 'createdAt' | 'read'>,
    browser = false,
  ) => {
    const item: LiuNotification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      read: false,
    };
    setNotifications((current) => [item, ...current].slice(0, 50));
    if (browser && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const systemNotification = new Notification(item.title, {
        body: item.body,
        tag: `${item.appId}:${item.actionId ?? item.id}`,
        silent: false,
      });
      window.setTimeout(() => systemNotification.close(), 8_000);
    }
  }, []);

  const appendMessage = useCallback((message: ShareMessage) => {
    setMessages((current) => ({
      ...current,
      [message.roomCode]: [
        ...(current[message.roomCode] ?? []).filter((item) => item.id !== message.id),
        message,
      ].sort((a, b) => a.createdAt - b.createdAt),
    }));
    void saveShareMessage(message);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await cleanupExpiredInbox();
      const [storedTransfers, storedInbox] = await Promise.all([
        listShareTransfers(),
        listInboxItems(),
      ]);
      if (!active) return;
      setTransfers(storedTransfers.map((transfer) => {
        if (transfer.status === 'completed' || transfer.status === 'cancelled') return transfer;
        return {
          ...transfer,
          status: transfer.direction === 'send' ? 'waiting-source' : 'paused',
          speed: 0,
          etaSeconds: null,
          requiresAction: true,
        };
      }));
      setInbox(storedInbox);
      storedInbox
        .filter((item) => !item.pinned && item.expiresAt - Date.now() <= 24 * 60 * 60 * 1000 && item.expiresAt > Date.now())
        .forEach((item) => notify({
          kind: 'warning',
          title: localized('文件即将清理', 'File cleanup reminder'),
          body: localized(
            `${item.name} 将在 24 小时内自动清理，可固定保留。`,
            `${item.name} will be cleared within 24 hours. Pin it to keep it.`,
          ),
          appId: 'transferCenter',
          actionId: item.id,
        }));
    })().catch(() => {
      notify({
        kind: 'error',
        title: localized('本地收件箱不可用', 'Local inbox unavailable'),
        body: localized('浏览器暂时无法读取本地传输记录。', 'The browser could not read local transfer records.'),
        appId: 'transferCenter',
      });
    });
    return () => {
      active = false;
    };
  }, [notify]);

  useEffect(() => {
    Object.values(sessions).forEach((session) => {
      if (!session || messages[session.code]) return;
      void listShareMessages(session.code).then((stored) => {
        setMessages((current) => ({ ...current, [session.code]: stored }));
      });
    });
  }, [messages, sessions]);

  const sendWire = useCallback((mode: ShareMode, peerId: string, message: WireMessage) => {
    const peer = peersRef.current.get(connectionKey(mode, peerId));
    if (!peer?.channel || peer.channel.readyState !== 'open' || !peer.pathVerified) {
      throw new Error('peer-not-connected');
    }
    peer.channel.send(JSON.stringify(message));
  }, []);

  const finishReceivedTransfer = useCallback(async (transferId: string) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    const runtime = receiverRef.current.get(transferId);
    if (!transfer || !runtime) return;
    let blob: Blob | undefined;
    let storage: ShareInboxItem['storage'] = 'indexeddb';
    if (runtime.writer && runtime.opfsName) {
      await runtime.writer.close();
      storage = 'opfs';
    } else {
      const parts = runtime.chunks.map((chunk) => chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      ) as ArrayBuffer);
      blob = new Blob(parts, { type: transfer.file.type || 'application/octet-stream' });
    }
    const item: ShareInboxItem = {
      id: transfer.file.id,
      roomCode: transfer.roomCode,
      mode: transfer.mode,
      name: sanitizeShareFileName(transfer.file.name),
      type: transfer.file.type || 'application/octet-stream',
      size: transfer.file.size,
      senderName: transfer.file.senderName,
      receivedAt: Date.now(),
      expiresAt: inboxExpiryFor(),
      pinned: false,
      storage,
      blobId: blob ? `share-blob:${transfer.file.id}` : undefined,
      opfsName: runtime.opfsName,
      previewKind: classifySharePreview({
        name: transfer.file.name,
        type: transfer.file.type,
      }),
    };
    await saveInboxItem(item, blob);
    receiverRef.current.delete(transferId);
    setInbox((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
    updateTransfer(transferId, {
      status: 'completed',
      transferredBytes: transfer.file.size,
      speed: 0,
      etaSeconds: 0,
      requiresAction: true,
      storage,
    });
    try {
      sendWire(transfer.mode, transfer.peerId, { v: 1, type: 'file-received', transferId });
    } catch {
      // The receiver keeps the completed file even if the acknowledgement is lost.
    }
    notify({
      kind: 'transfer',
      title: localized('接收完成', 'Receive complete'),
      body: localized(`${item.name} 已保存到本地收件箱。`, `${item.name} was saved to the local inbox.`),
      appId: transfer.mode === 'private' ? 'privateShare' : 'lanShare',
      actionId: transferId,
    }, true);
  }, [notify, sendWire, updateTransfer]);

  const consumeBinaryChunk = useCallback(async (
    runtime: PeerRuntime,
    chunk: ArrayBuffer,
  ) => {
    const header = runtime.pendingChunk;
    runtime.pendingChunk = null;
    if (!header || chunk.byteLength !== header.length) return;
    const transfer = transfersRef.current.find((item) => item.id === header.transferId);
    const receiver = receiverRef.current.get(header.transferId);
    if (!transfer || !receiver || transfer.status !== 'transferring') return;
    if (
      transfer.peerId !== runtime.peerId
      || header.offset !== receiver.nextOffset
      || header.offset + chunk.byteLength > transfer.file.size
    ) {
      throw new Error('invalid-chunk-offset');
    }
    if (receiver.writer) {
      await receiver.writer.write({
        type: 'write',
        position: header.offset,
        data: new Uint8Array(chunk),
      });
    } else {
      receiver.chunks.push(new Uint8Array(chunk));
    }
    const bytes = Math.min(transfer.file.size, header.offset + chunk.byteLength);
    receiver.nextOffset = bytes;
    const previous = pendingProgressRef.current.get(header.transferId) ?? {
      bytes: transfer.transferredBytes,
      at: Date.now(),
    };
    const now = Date.now();
    const elapsed = Math.max(1, now - previous.at);
    const speed = Math.max(0, ((bytes - previous.bytes) * 1000) / elapsed);
    if (now - previous.at >= 240 || bytes >= transfer.file.size) {
      pendingProgressRef.current.set(header.transferId, { bytes, at: now });
      updateTransfer(header.transferId, {
        transferredBytes: bytes,
        speed,
        etaSeconds: speed > 0 ? Math.ceil((transfer.file.size - bytes) / speed) : null,
      });
    }
    if (bytes >= transfer.file.size) await finishReceivedTransfer(header.transferId);
  }, [finishReceivedTransfer, updateTransfer]);

  const sendFileData = useCallback(async (transferId: string, offset: number) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    const file = sourceFilesRef.current.get(transferId);
    if (!transfer || !file) {
      updateTransfer(transferId, {
        status: 'waiting-source',
        requiresAction: true,
        error: 'source-file-required',
      });
      return;
    }
    const peer = peersRef.current.get(connectionKey(transfer.mode, transfer.peerId));
    const channel = peer?.channel;
    if (!channel || channel.readyState !== 'open' || !peer.pathVerified) {
      updateTransfer(transferId, { status: 'connecting', error: 'peer-not-connected' });
      return;
    }
    updateTransfer(transferId, {
      status: 'transferring',
      transferredBytes: offset,
      requiresAction: false,
      error: undefined,
    });
    let position = offset;
    let progressBytes = offset;
    let progressAt = Date.now();
    try {
      while (position < file.size) {
        const latest = transfersRef.current.find((item) => item.id === transferId);
        if (!latest || latest.status === 'cancelled' || latest.status === 'paused') return;
        await waitForChannelCapacity(channel);
        const chunk = await file.slice(position, Math.min(file.size, position + CHUNK_BYTES)).arrayBuffer();
        channel.send(JSON.stringify({
          v: 1,
          type: 'chunk-header',
          transferId,
          offset: position,
          length: chunk.byteLength,
        } satisfies WireMessage));
        channel.send(chunk);
        position += chunk.byteLength;
        const now = Date.now();
        if (now - progressAt >= 240 || position >= file.size) {
          const speed = Math.max(0, ((position - progressBytes) * 1000) / Math.max(1, now - progressAt));
          progressBytes = position;
          progressAt = now;
          updateTransfer(transferId, {
            transferredBytes: position,
            speed,
            etaSeconds: speed > 0 ? Math.ceil((file.size - position) / speed) : null,
          });
        }
      }
      channel.send(JSON.stringify({ v: 1, type: 'file-complete', transferId } satisfies WireMessage));
    } catch (error) {
      updateTransfer(transferId, {
        status: 'failed',
        speed: 0,
        etaSeconds: null,
        requiresAction: true,
        error: error instanceof Error ? error.message : 'transfer-failed',
      });
    }
  }, [updateTransfer]);

  const handleWireMessage = useCallback(async (
    mode: ShareMode,
    peerId: string,
    wire: WireMessage,
  ) => {
    const session = sessionsRef.current[mode];
    if (!session) return;
    if (wire.type === 'chat') {
      if (wire.message.roomCode !== session.code || wire.message.senderId !== peerId) return;
      const verifiedSenderName = session.members.find((member) => member.id === peerId)?.nickname
        ?? wire.message.senderName;
      const verifiedMessage = { ...wire.message, senderName: verifiedSenderName };
      appendMessage(verifiedMessage);
      notify({
        kind: 'info',
        title: verifiedSenderName,
        body: wire.message.text || wire.message.file?.name || '发来一条消息',
        appId: mode === 'private' ? 'privateShare' : 'lanShare',
        actionId: wire.message.id,
      }, true);
      return;
    }
    if (wire.type === 'file-offer') {
      if (
        wire.transfer.roomCode !== session.code
        || wire.transfer.mode !== mode
        || wire.transfer.file.senderId !== peerId
        || wire.transfer.peerId !== session.memberId
      ) return;
      const verifiedSenderName = session.members.find((member) => member.id === peerId)?.nickname
        ?? wire.transfer.file.senderName;
      const incoming: ShareTransfer = {
        ...wire.transfer,
        direction: 'receive',
        peerId,
        peerName: verifiedSenderName,
        file: {
          ...wire.transfer.file,
          name: sanitizeShareFileName(wire.transfer.file.name),
          senderName: verifiedSenderName,
        },
        status: 'pending',
        transferredBytes: wire.transfer.transferredBytes || 0,
        speed: 0,
        etaSeconds: null,
        requiresAction: true,
        updatedAt: Date.now(),
      };
      addTransfer(incoming);
      appendMessage({
        id: `message:${incoming.id}`,
        roomCode: session.code,
        senderId: incoming.file.senderId,
        senderName: incoming.file.senderName,
        kind: incoming.file.type.startsWith('image/') ? 'image' : 'file',
        file: incoming.file,
        createdAt: Date.now(),
      });
      notify({
        kind: 'transfer',
        title: localized('收到文件', 'Incoming file'),
        body: localized(
          `${incoming.file.senderName} 发来 ${incoming.file.name}`,
          `${incoming.file.senderName} sent ${incoming.file.name}`,
        ),
        appId: mode === 'private' ? 'privateShare' : 'lanShare',
        actionId: incoming.id,
      }, true);
      return;
    }
    if (wire.type === 'file-accept') {
      const transfer = transfersRef.current.find((item) => item.id === wire.transferId);
      if (!transfer || transfer.peerId !== peerId || wire.offset > transfer.file.size) return;
      void sendFileData(wire.transferId, wire.offset);
      return;
    }
    if (wire.type === 'file-reject') {
      const transfer = transfersRef.current.find((item) => item.id === wire.transferId);
      if (!transfer || transfer.direction !== 'send' || transfer.peerId !== peerId) return;
      sourceFilesRef.current.delete(wire.transferId);
      updateTransfer(wire.transferId, {
        status: 'cancelled',
        error: 'receiver-rejected',
        requiresAction: false,
      });
      return;
    }
    if (wire.type === 'file-control') {
      const transfer = transfersRef.current.find((item) => item.id === wire.transferId);
      if (!transfer || transfer.peerId !== peerId) return;
      if (wire.action === 'cancel') {
        const receiver = receiverRef.current.get(wire.transferId);
        receiverRef.current.delete(wire.transferId);
        if (receiver?.writer) {
          void receiver.writer.abort('transfer-cancelled-by-peer').catch(() => undefined);
        }
      }
      updateTransfer(wire.transferId, {
        status: wire.action === 'pause' ? 'paused' : 'cancelled',
        speed: 0,
        etaSeconds: null,
        requiresAction: wire.action === 'pause',
      });
      return;
    }
    if (wire.type === 'chunk-header') {
      const peer = peersRef.current.get(connectionKey(mode, peerId));
      const transfer = transfersRef.current.find((item) => item.id === wire.transferId);
      const receiver = receiverRef.current.get(wire.transferId);
      if (
        !peer
        || peer.pendingChunk
        || !transfer
        || transfer.direction !== 'receive'
        || transfer.peerId !== peerId
        || transfer.status !== 'transferring'
        || !receiver
        || wire.offset !== receiver.nextOffset
        || wire.offset + wire.length > transfer.file.size
      ) return;
      peer.pendingChunk = {
        transferId: wire.transferId,
        offset: wire.offset,
        length: wire.length,
      };
      return;
    }
    if (wire.type === 'file-complete') {
      const transfer = transfersRef.current.find((item) => item.id === wire.transferId);
      const receiver = receiverRef.current.get(wire.transferId);
      if (
        transfer
        && transfer.direction === 'receive'
        && transfer.peerId === peerId
        && receiver
        && receiver.nextOffset >= transfer.file.size
      ) {
        await finishReceivedTransfer(wire.transferId);
      }
      return;
    }
    if (wire.type === 'file-received') {
      const transfer = transfersRef.current.find((item) => item.id === wire.transferId);
      if (!transfer || transfer.direction !== 'send' || transfer.peerId !== peerId) return;
      sourceFilesRef.current.delete(wire.transferId);
      updateTransfer(wire.transferId, {
        status: 'completed',
        transferredBytes: transfer.file.size,
        speed: 0,
        etaSeconds: 0,
        requiresAction: true,
      });
      notify({
        kind: 'transfer',
        title: localized('发送完成', 'Send complete'),
        body: transfer.file.name,
        appId: mode === 'private' ? 'privateShare' : 'lanShare',
        actionId: wire.transferId,
      }, true);
    }
  }, [addTransfer, appendMessage, finishReceivedTransfer, notify, sendFileData, updateTransfer]);

  const wireChannel = useCallback((runtime: PeerRuntime, channel: RTCDataChannel) => {
    runtime.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      runtime.pathVerified = true;
      setPeerConnected(runtime.mode, runtime.peerId, true);
      updateSessions((current) => {
        const session = current[runtime.mode];
        if (!session) return current;
        return { ...current, [runtime.mode]: { ...session, state: 'connected', error: undefined } };
      });
      transfersRef.current
        .filter((transfer) => (
          transfer.direction === 'send'
          && transfer.mode === runtime.mode
          && transfer.peerId === runtime.peerId
          && ['pending', 'connecting'].includes(transfer.status)
        ))
        .forEach((transfer) => {
          channel.send(JSON.stringify({ v: 1, type: 'file-offer', transfer } satisfies WireMessage));
          updateTransfer(transfer.id, { status: 'pending', error: undefined });
        });
    };
    channel.onclose = () => {
      const current = peersRef.current.get(connectionKey(runtime.mode, runtime.peerId));
      if (current === runtime && current.channel === channel) {
        setPeerConnected(runtime.mode, runtime.peerId, false);
        runtime.pathVerified = false;
        peersRef.current.delete(connectionKey(runtime.mode, runtime.peerId));
        const session = sessionsRef.current[runtime.mode];
        if (session) {
          announcedPeersRef.current.delete(
            `${runtime.mode}:${session.code}:${session.memberId}:${runtime.peerId}`,
          );
        }
        if (runtime.connection.signalingState !== 'closed') runtime.connection.close();
      }
    };
    channel.onerror = () => {
      const current = peersRef.current.get(connectionKey(runtime.mode, runtime.peerId));
      if (current === runtime && current.channel === channel) {
        setPeerConnected(runtime.mode, runtime.peerId, false);
        runtime.pathVerified = false;
      }
    };
    channel.onmessage = (event: MessageEvent<string | ArrayBuffer | Blob>) => {
      runtime.processing = runtime.processing.then(async () => {
        if (typeof event.data === 'string') {
          const wire = parseWireMessage(event.data);
          if (wire) await handleWireMessage(runtime.mode, runtime.peerId, wire);
          return;
        }
        const buffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
        const transferId = runtime.pendingChunk?.transferId;
        try {
          await consumeBinaryChunk(runtime, buffer);
        } catch (error) {
          if (transferId) {
            updateTransfer(transferId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'received-chunk-failed',
              requiresAction: true,
            });
          }
          throw error;
        }
      }).catch(() => {
        runtime.pendingChunk = null;
      });
    };
  }, [consumeBinaryChunk, handleWireMessage, setPeerConnected, updateSessions, updateTransfer]);

  const createPeer = useCallback((mode: ShareMode, peerId: string, initiator: boolean) => {
    const key = connectionKey(mode, peerId);
    const existing = peersRef.current.get(key);
    if (existing && existing.connection.signalingState !== 'closed') return existing;
    const session = sessionsRef.current[mode];
    if (!session) throw new Error('room-not-connected');
    const connection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 4,
    });
    const runtime: PeerRuntime = {
      mode,
      peerId,
      connection,
      channel: null,
      pathVerified: false,
      pendingChunk: null,
      pendingIce: [],
      processing: Promise.resolve(),
    };
    peersRef.current.set(key, runtime);
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignalEvent(session, 'ice', event.candidate.toJSON(), peerId).catch(() => undefined);
      }
    };
    connection.ondatachannel = (event) => wireChannel(runtime, event.channel);
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        if (mode !== 'lan' || runtime.pathVerified) setPeerConnected(mode, peerId, true);
        return;
      }
      if (connection.connectionState === 'closed') {
        setPeerConnected(mode, peerId, false);
        return;
      }
      if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
        setPeerConnected(mode, peerId, false);
        updateSessions((current) => {
          const latest = current[mode];
          if (!latest) return current;
          return { ...current, [mode]: { ...latest, state: 'reconnecting' } };
        });
        window.setTimeout(() => {
          if (connection.connectionState === 'connected') return;
          connection.close();
          peersRef.current.delete(key);
          const latest = sessionsRef.current[mode];
          if (!latest) return;
          announcedPeersRef.current.delete(`${mode}:${latest.code}:${latest.memberId}:${peerId}`);
        }, 12_000);
      }
    };
    if (initiator) {
      wireChannel(runtime, connection.createDataChannel('liu-os-share', {
        ordered: true,
      }));
    }
    window.setTimeout(() => {
      const current = peersRef.current.get(key);
      if (
        current !== runtime
        || current.channel?.readyState === 'open'
        || current.connection.connectionState === 'connected'
      ) return;
      current.connection.close();
      peersRef.current.delete(key);
      setPeerConnected(mode, peerId, false);
      const latest = sessionsRef.current[mode];
      if (latest) {
        announcedPeersRef.current.delete(`${mode}:${latest.code}:${latest.memberId}:${peerId}`);
      }
    }, 12_000);
    return runtime;
  }, [setPeerConnected, updateSessions, wireChannel]);

  const createOffer = useCallback(async (mode: ShareMode, peerId: string) => {
    const session = sessionsRef.current[mode];
    if (!session) return;
    const runtime = createPeer(mode, peerId, true);
    if (
      runtime.channel?.readyState === 'open'
      || runtime.connection.connectionState === 'connected'
      || runtime.connection.connectionState === 'connecting'
    ) return;
    if (runtime.connection.signalingState !== 'stable') return;
    const offer = await runtime.connection.createOffer();
    await runtime.connection.setLocalDescription(offer);
    await sendSignalEvent(session, 'offer', offer, peerId);
  }, [createPeer]);

  const waitForOpenChannel = useCallback(async (
    mode: ShareMode,
    peerId: string,
    timeoutMs = 25_000,
  ) => {
    const session = sessionsRef.current[mode];
    if (!session) throw new Error('room-not-connected');
    const current = peersRef.current.get(connectionKey(mode, peerId));
    if (current?.channel?.readyState === 'open' && current.pathVerified) return current.channel;
    if (shouldInitiatePeer(session.memberId, peerId)) {
      await createOffer(mode, peerId);
    } else {
      await sendSignalEvent(session, 'peer-ready', {}, peerId);
    }
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const runtime = peersRef.current.get(connectionKey(mode, peerId));
      if (runtime?.channel?.readyState === 'open' && runtime.pathVerified) return runtime.channel;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    throw new Error('peer-not-connected');
  }, [createOffer]);

  const handleSignalEvent = useCallback(async (mode: ShareMode, event: SignalEvent) => {
    const session = sessionsRef.current[mode];
    if (!session) return;
    if (event.type === 'join-request') {
      const member = event.payload as ShareMember;
      updateSessions((current) => {
        const latest = current[mode];
        if (!latest) return current;
        return {
          ...current,
          [mode]: {
            ...latest,
            members: [...latest.members.filter((item) => item.id !== member.id), member],
          },
        };
      });
      notify({
        kind: 'member',
        title: localized('加入请求', 'Join request'),
        body: localized(`${member.nickname} 请求加入房间。`, `${member.nickname} wants to join the room.`),
        appId: mode === 'private' ? 'privateShare' : 'lanShare',
        actionId: member.id,
      }, true);
      return;
    }
    if (event.type === 'approval') {
      const payload = event.payload as { approved?: boolean };
      updateSessions((current) => {
        const latest = current[mode];
        if (!latest) return current;
        return {
          ...current,
          [mode]: {
            ...latest,
            state: payload.approved ? 'connected' : 'error',
            error: payload.approved ? undefined : 'join-declined',
          },
        };
      });
      return;
    }
    if (event.type === 'member-joined') {
      const member = event.payload as ShareMember;
      if (!member?.id || member.id === session.memberId) return;
      const systemMessage: ShareMessage = {
        id: `member-joined:${session.code}:${member.id}:${event.id}`,
        roomCode: session.code,
        senderId: 'system',
        senderName: 'Liu OS',
        kind: 'system',
        text: localized(`${member.nickname} 加入了房间`, `${member.nickname} joined the room`),
        createdAt: event.createdAt,
      };
      appendMessage(systemMessage);
      notify({
        kind: 'member',
        title: localized('成员已加入', 'Member joined'),
        body: member.nickname,
        appId: mode === 'private' ? 'privateShare' : 'lanShare',
        actionId: member.id,
      }, true);
      if (shouldInitiatePeer(session.memberId, member.id)) {
        await createOffer(mode, member.id);
      } else {
        await sendSignalEvent(session, 'peer-ready', {}, member.id);
      }
      return;
    }
    if (event.type === 'member-left') {
      const payload = event.payload as { memberId?: string; nickname?: string };
      if (payload.memberId) {
        const key = connectionKey(mode, payload.memberId);
        peersRef.current.get(key)?.connection.close();
        peersRef.current.delete(key);
        setPeerConnected(mode, payload.memberId, false);
      }
      appendMessage({
        id: `member-left:${session.code}:${event.id}`,
        roomCode: session.code,
        senderId: 'system',
        senderName: 'Liu OS',
        kind: 'system',
        text: localized(`${payload.nickname || '成员'} 离开了房间`, `${payload.nickname || 'A member'} left the room`),
        createdAt: event.createdAt,
      });
      return;
    }
    if (event.type === 'chat-relay') {
      if (mode !== 'private') return;
      const message = await decryptRelayMessage(session.code, event.payload);
      if (
        !message
        || message.roomCode !== session.code
        || message.senderId !== event.fromMemberId
      ) return;
      const verifiedSenderName = session.members.find((member) => member.id === event.fromMemberId)?.nickname
        ?? message.senderName;
      appendMessage({ ...message, senderName: verifiedSenderName });
      notify({
        kind: 'info',
        title: verifiedSenderName,
        body: message.text || '发来一条消息',
        appId: 'privateShare',
        actionId: message.id,
      }, true);
      return;
    }
    if (event.type === 'room-settings') {
      const settings = event.payload as ShareRoomSettings;
      updateSessions((current) => {
        const latest = current[mode];
        return latest ? { ...current, [mode]: { ...latest, settings } } : current;
      });
      return;
    }
    if (event.type === 'peer-ready') {
      if (shouldInitiatePeer(session.memberId, event.fromMemberId)) {
        await createOffer(mode, event.fromMemberId);
      }
      return;
    }
    if (event.type === 'offer') {
      let runtime = createPeer(mode, event.fromMemberId, false);
      if (runtime.connection.signalingState !== 'stable') {
        if (shouldInitiatePeer(session.memberId, event.fromMemberId)) return;
        runtime.connection.close();
        peersRef.current.delete(connectionKey(mode, event.fromMemberId));
        setPeerConnected(mode, event.fromMemberId, false);
        runtime = createPeer(mode, event.fromMemberId, false);
      }
      await runtime.connection.setRemoteDescription(event.payload as RTCSessionDescriptionInit);
      for (const candidate of runtime.pendingIce.splice(0)) {
        await runtime.connection.addIceCandidate(candidate).catch(() => undefined);
      }
      const answer = await runtime.connection.createAnswer();
      await runtime.connection.setLocalDescription(answer);
      await sendSignalEvent(session, 'answer', answer, event.fromMemberId);
      return;
    }
    if (event.type === 'answer') {
      const runtime = peersRef.current.get(connectionKey(mode, event.fromMemberId));
      if (runtime && runtime.connection.signalingState === 'have-local-offer') {
        await runtime.connection.setRemoteDescription(event.payload as RTCSessionDescriptionInit);
        for (const candidate of runtime.pendingIce.splice(0)) {
          await runtime.connection.addIceCandidate(candidate).catch(() => undefined);
        }
      }
      return;
    }
    if (event.type === 'ice') {
      const runtime = createPeer(mode, event.fromMemberId, false);
      const candidate = event.payload as RTCIceCandidateInit;
      if (!runtime.connection.remoteDescription) runtime.pendingIce.push(candidate);
      else await runtime.connection.addIceCandidate(candidate).catch(() => undefined);
    }
  }, [appendMessage, createOffer, createPeer, notify, setPeerConnected, updateSessions]);

  useEffect(() => {
    const controllers = new Map<ShareMode, AbortController>();
    (['private', 'lan'] as const).forEach((mode) => {
      const initial = sessionsRef.current[mode];
      if (!initial || !initial.code || initial.state === 'creating') return;
      const identityKey = sessionKey(initial);
      const controller = new AbortController();
      controllers.set(mode, controller);
      void (async () => {
        let lastHeartbeat = 0;
        while (!controller.signal.aborted) {
          const session = sessionsRef.current[mode];
          if (!session || sessionKey(session) !== identityKey) break;
          try {
            const currentCursor = cursorsRef.current.get(identityKey) ?? session.signalCursor;
            const polled = await pollSignalEvents(session, currentCursor);
            if (sessionKey(sessionsRef.current[mode] ?? session) !== identityKey) break;
            updateSessions((current) => {
              const latest = current[mode];
              if (!latest || sessionKey(latest) !== identityKey) return current;
              return {
                ...current,
                [mode]: {
                  ...latest,
                  members: polled.members,
                  settings: polled.settings,
                  expiresAt: polled.expiresAt,
                  signalCursor: polled.cursor,
                  state: latest.state === 'joining' ? latest.state : 'connected',
                  error: undefined,
                },
              };
            });
            let handledCursor = currentCursor;
            for (const event of polled.events) {
              try {
                await handleSignalEvent(mode, event);
              } catch {
                const peerKey = connectionKey(mode, event.fromMemberId);
                const stalePeer = peersRef.current.get(peerKey);
                stalePeer?.connection.close();
                peersRef.current.delete(peerKey);
                setPeerConnected(mode, event.fromMemberId, false);
                announcedPeersRef.current.delete(
                  `${mode}:${session.code}:${session.memberId}:${event.fromMemberId}`,
                );
              } finally {
                handledCursor = event.id;
                cursorsRef.current.set(identityKey, handledCursor);
              }
            }
            if (!polled.events.length || handledCursor === polled.cursor) {
              cursorsRef.current.set(identityKey, polled.cursor);
            }
            const activeSession = sessionsRef.current[mode];
            if (activeSession?.state === 'connected' && sessionKey(activeSession) === identityKey) {
              for (const member of polled.members.filter((item) => item.status === 'active' && item.id !== activeSession.memberId)) {
                const announceKey = `${mode}:${activeSession.code}:${activeSession.memberId}:${member.id}`;
                if (!announcedPeersRef.current.has(announceKey)) {
                  announcedPeersRef.current.add(announceKey);
                  try {
                    if (shouldInitiatePeer(activeSession.memberId, member.id)) {
                      await createOffer(mode, member.id);
                    } else {
                      await sendSignalEvent(activeSession, 'peer-ready', {}, member.id);
                    }
                  } catch (error) {
                    announcedPeersRef.current.delete(announceKey);
                    throw error;
                  }
                }
              }
            }
            if (Date.now() - lastHeartbeat > 10_000) {
              const latest = sessionsRef.current[mode];
              if (!latest || sessionKey(latest) !== identityKey) break;
              await heartbeatSignalRoom(latest);
              lastHeartbeat = Date.now();
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'connection-lost';
            const fatal = [
              'unauthorized-member',
              'room-expired',
              'member-id-conflict',
            ].includes(errorMessage);
            updateSessions((current) => {
              const latest = current[mode];
              if (!latest || sessionKey(latest) !== identityKey) return current;
              return {
                ...current,
                [mode]: {
                  ...latest,
                  state: fatal ? 'error' : 'reconnecting',
                  error: errorMessage,
                },
              };
            });
            if (fatal) break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1_100));
        }
      })();
    });
    return () => controllers.forEach((controller) => controller.abort());
  }, [
    createOffer,
    handleSignalEvent,
    sessions.private?.code,
    sessions.private?.memberId,
    sessions.private?.state,
    sessions.lan?.code,
    sessions.lan?.memberId,
    sessions.lan?.state,
    setPeerConnected,
    updateSessions,
  ]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!transfersRef.current.some((transfer) => isActiveTransfer(transfer.status))) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const createRoom = useCallback(async (mode: ShareMode, options: ShareRoomCreateOptions) => {
    const identity = makeIdentity();
    resetModeRuntime(mode);
    updateSessions((current) => ({
      ...current,
      [mode]: {
        code: options.code ?? '',
        mode,
        ...identity,
        nickname: options.nickname,
        isHost: true,
        hostMemberId: identity.memberId,
        state: 'creating',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
        settings: {
          approvalRequired: options.approvalRequired,
          maxMembers: options.maxMembers,
          fileRecipients: 'selected',
        },
        members: [],
      },
    }));
    try {
      const response = await createSignalRoom({ mode, ...identity, ...options });
      const session: ShareRoomSession = {
        code: response.code,
        mode,
        signalCursor: response.cursor,
        ...identity,
        nickname: options.nickname,
        isHost: true,
        hostMemberId: response.hostMemberId,
        state: 'connected',
        createdAt: Date.now(),
        expiresAt: response.expiresAt,
        settings: response.settings,
        members: response.members,
      };
      cursorsRef.current.set(sessionKey(session), response.cursor);
      updateSessions((current) => ({ ...current, [mode]: session }));
      setMessages((current) => ({ ...current, [session.code]: current[session.code] ?? [] }));
    } catch (error) {
      updateSessions((current) => {
        const latest = current[mode];
        return latest ? {
          ...current,
          [mode]: {
            ...latest,
            state: 'error',
            error: error instanceof Error ? error.message : 'room-create-failed',
          },
        } : current;
      });
      throw error;
    }
  }, [resetModeRuntime, updateSessions]);

  const joinRoom = useCallback(async (mode: ShareMode, options: ShareRoomJoinOptions) => {
    const identity = makeIdentity();
    resetModeRuntime(mode);
    const placeholder: ShareRoomSession = {
      code: options.code,
      mode,
      signalCursor: 0,
      ...identity,
      nickname: options.nickname,
      isHost: false,
      hostMemberId: '',
      state: 'creating',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
      settings: {
        approvalRequired: false,
        maxMembers: mode === 'private' ? 8 : 20,
        fileRecipients: 'selected',
      },
      members: [],
    };
    updateSessions((current) => ({ ...current, [mode]: placeholder }));
    try {
      const response = await joinSignalRoom({ mode, ...identity, ...options });
      const session: ShareRoomSession = {
        ...placeholder,
        signalCursor: response.cursor,
        hostMemberId: response.hostMemberId,
        state: response.status === 'pending' ? 'joining' : 'connected',
        expiresAt: response.expiresAt,
        settings: response.settings,
        members: response.members,
      };
      cursorsRef.current.set(sessionKey(session), response.cursor);
      updateSessions((current) => ({
        ...current,
        [mode]: session,
      }));
      const stored = await listShareMessages(options.code);
      setMessages((current) => ({ ...current, [options.code]: stored }));
    } catch (error) {
      updateSessions((current) => ({
        ...current,
        [mode]: {
          ...placeholder,
          state: 'error',
          error: error instanceof Error ? error.message : 'room-join-failed',
        },
      }));
      throw error;
    }
  }, [resetModeRuntime, updateSessions]);

  const leaveRoom = useCallback(async (mode: ShareMode, force = false) => {
    const session = sessionsRef.current[mode];
    if (!session) return true;
    const active = transfersRef.current.some((transfer) => (
      transfer.mode === mode && isActiveTransfer(transfer.status)
    ));
    if (active && !force) return false;
    await leaveSignalRoom(session).catch(() => undefined);
    resetModeRuntime(mode);
    cursorsRef.current.delete(sessionKey(session));
    updateSessions((current) => {
      const next = { ...current };
      delete next[mode];
      return next;
    });
    return true;
  }, [resetModeRuntime, updateSessions]);

  const sendText = useCallback(async (mode: ShareMode, value: string) => {
    const session = sessionsRef.current[mode];
    const text = value.trim().slice(0, 20_000);
    if (!session || !text) return;
    const message: ShareMessage = {
      id: crypto.randomUUID(),
      roomCode: session.code,
      senderId: session.memberId,
      senderName: session.nickname,
      kind: /^https?:\/\/\S+$/i.test(text) ? 'link' : 'text',
      text,
      createdAt: Date.now(),
    };
    const peers = session.members.filter((member) => member.status === 'active' && member.id !== session.memberId);
    if (!peers.length) throw new Error('no-recipient-selected');
    const relayPayload = mode === 'private'
      ? await encryptRelayMessage(session.code, message)
      : null;
    const results = await Promise.allSettled(peers.map(async (member) => {
      try {
        const channel = await waitForOpenChannel(
          mode,
          member.id,
          mode === 'private' ? 5_000 : 15_000,
        );
        channel.send(JSON.stringify({ v: 1, type: 'chat', message } satisfies WireMessage));
      } catch (error) {
        if (mode !== 'private' || !relayPayload) throw error;
        await sendSignalEvent(session, 'chat-relay', relayPayload, member.id);
      }
    }));
    if (!results.some((result) => result.status === 'fulfilled')) {
      throw new Error('peer-not-connected');
    }
    appendMessage(message);
  }, [appendMessage, waitForOpenChannel]);

  const sendFiles = useCallback(async (mode: ShareMode, files: File[], recipients: string[]) => {
    const session = sessionsRef.current[mode];
    if (!session || !files.length) return;
    const activeRecipients = session.members.filter((member) => (
      member.status === 'active'
      && member.id !== session.memberId
      && (recipients.length === 0 || recipients.includes(member.id))
    ));
    if (!activeRecipients.length) throw new Error('no-recipient-selected');
    for (const file of files) {
      const fingerprint = await fileFingerprint(file);
      for (const member of activeRecipients) {
        const transferId = crypto.randomUUID();
        const descriptor: ShareFileDescriptor = {
          id: crypto.randomUUID(),
          transferId,
          name: sanitizeShareFileName(file.name),
          type: file.type || 'application/octet-stream',
          size: file.size,
          lastModified: file.lastModified,
          fingerprint,
          senderId: session.memberId,
          senderName: session.nickname,
        };
        const transfer: ShareTransfer = {
          id: transferId,
          roomCode: session.code,
          mode,
          direction: 'send',
          file: descriptor,
          peerId: member.id,
          peerName: member.nickname,
          status: 'pending',
          transferredBytes: 0,
          speed: 0,
          etaSeconds: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          requiresAction: false,
        };
        sourceFilesRef.current.set(transferId, file);
        addTransfer(transfer);
        try {
          sendWire(mode, member.id, { v: 1, type: 'file-offer', transfer });
        } catch {
          updateTransfer(transferId, {
            status: 'connecting',
            error: 'peer-not-connected',
            requiresAction: true,
          });
          void waitForOpenChannel(mode, member.id).catch(() => {
            updateTransfer(transferId, {
              status: 'failed',
              error: 'peer-not-connected',
              requiresAction: true,
            });
          });
        }
      }
      appendMessage({
        id: crypto.randomUUID(),
        roomCode: session.code,
        senderId: session.memberId,
        senderName: session.nickname,
        kind: messageKindForFile(file),
        text: activeRecipients.length > 1 ? `发送给 ${activeRecipients.length} 位成员` : undefined,
        createdAt: Date.now(),
        localOnly: true,
      });
    }
  }, [addTransfer, appendMessage, sendWire, updateTransfer, waitForOpenChannel]);

  const acceptTransfer = useCallback(async (transferId: string) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    if (!transfer || transfer.direction !== 'receive') return;
    if (!await hasStorageFor(Math.max(0, transfer.file.size - transfer.transferredBytes))) {
      updateTransfer(transferId, {
        status: 'failed',
        error: 'insufficient-local-storage',
        requiresAction: true,
      });
      throw new Error('insufficient-local-storage');
    }
    let runtime = receiverRef.current.get(transferId);
    let resumeOffset = transfer.transferredBytes;
    if (!runtime) {
      const opfs = await createOpfsWriter(transferId, transfer.transferredBytes > 0).catch(() => null);
      if (opfs) {
        resumeOffset = Math.min(transfer.transferredBytes, opfs.existingSize, transfer.file.size);
        if (opfs.existingSize !== resumeOffset) await opfs.writable.truncate(resumeOffset);
      } else {
        resumeOffset = 0;
      }
      runtime = {
        writer: opfs?.writable ?? null,
        opfsName: opfs?.opfsName,
        chunks: [],
        nextOffset: resumeOffset,
      };
      receiverRef.current.set(transferId, runtime);
    } else {
      resumeOffset = runtime.writer
        ? Math.min(transfer.transferredBytes, runtime.nextOffset)
        : Math.min(
          transfer.transferredBytes,
          runtime.chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
        );
      runtime.nextOffset = resumeOffset;
    }
    if (!runtime.writer && transfer.file.size > MEMORY_FALLBACK_LIMIT) {
      receiverRef.current.delete(transferId);
      updateTransfer(transferId, {
        status: 'failed',
        error: 'streaming-storage-unavailable',
        requiresAction: true,
      });
      throw new Error('streaming-storage-unavailable');
    }
    updateTransfer(transferId, {
      status: 'transferring',
      transferredBytes: resumeOffset,
      requiresAction: false,
      storage: runtime.writer ? 'opfs' : 'memory',
      error: undefined,
    });
    sendWire(transfer.mode, transfer.peerId, {
      v: 1,
      type: 'file-accept',
      transferId,
      offset: resumeOffset,
    });
  }, [sendWire, updateTransfer]);

  const disposeReceiver = useCallback((transferId: string) => {
    const runtime = receiverRef.current.get(transferId);
    receiverRef.current.delete(transferId);
    if (runtime?.writer) {
      void runtime.writer.abort('transfer-cancelled').catch(() => undefined);
    }
  }, []);

  const rejectTransfer = useCallback((transferId: string) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    if (!transfer) return;
    disposeReceiver(transferId);
    updateTransfer(transferId, { status: 'cancelled', requiresAction: false });
    try {
      sendWire(transfer.mode, transfer.peerId, { v: 1, type: 'file-reject', transferId });
    } catch {
      // Local cancellation is authoritative even if the peer already left.
    }
  }, [disposeReceiver, sendWire, updateTransfer]);

  const pauseTransfer = useCallback((transferId: string) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    if (!transfer) return;
    updateTransfer(transferId, {
      status: 'paused',
      speed: 0,
      etaSeconds: null,
      requiresAction: true,
    });
    try {
      sendWire(transfer.mode, transfer.peerId, {
        v: 1,
        type: 'file-control',
        transferId,
        action: 'pause',
      });
    } catch {
      // The persisted paused state remains available for a later room reconnect.
    }
  }, [sendWire, updateTransfer]);

  const resumeTransfer = useCallback((transferId: string) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    if (!transfer) return;
    if (transfer.direction === 'send') {
      void sendFileData(transferId, transfer.transferredBytes);
      return;
    }
    void acceptTransfer(transferId);
  }, [acceptTransfer, sendFileData]);

  const cancelTransfer = useCallback((transferId: string) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    if (!transfer) return;
    disposeReceiver(transferId);
    updateTransfer(transferId, {
      status: 'cancelled',
      speed: 0,
      etaSeconds: null,
      requiresAction: false,
    });
    try {
      sendWire(transfer.mode, transfer.peerId, {
        v: 1,
        type: 'file-control',
        transferId,
        action: 'cancel',
      });
    } catch {
      // The local task is cancelled even if the room is offline.
    }
  }, [disposeReceiver, sendWire, updateTransfer]);

  const retryTransfer = useCallback((transferId: string) => resumeTransfer(transferId), [resumeTransfer]);

  const reselectTransferSource = useCallback(async (transferId: string, file: File) => {
    const transfer = transfersRef.current.find((item) => item.id === transferId);
    if (!transfer || transfer.direction !== 'send') return false;
    const fingerprint = await fileFingerprint(file);
    if (fingerprint !== transfer.file.fingerprint) return false;
    sourceFilesRef.current.set(transferId, file);
    updateTransfer(transferId, { status: 'paused', error: undefined, requiresAction: true });
    return true;
  }, [updateTransfer]);

  const approveMember = useCallback(async (mode: ShareMode, memberId: string, approved: boolean) => {
    const session = sessionsRef.current[mode];
    if (!session) return;
    await approveSignalMember(session, memberId, approved);
  }, []);

  const updateRoomSettings = useCallback(async (mode: ShareMode, settings: ShareRoomSettings) => {
    const session = sessionsRef.current[mode];
    if (!session) return;
    await updateSignalRoomSettings(session, settings);
    updateSessions((current) => {
      const latest = current[mode];
      return latest ? { ...current, [mode]: { ...latest, settings } } : current;
    });
  }, [updateSessions]);

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported' as const;
    browserNotificationAskedRef.current = true;
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const markNotificationsRead = useCallback((appId?: LiuNotification['appId']) => {
    setNotifications((current) => current.map((item) => (
      !appId || item.appId === appId ? { ...item, read: true } : item
    )));
    setTransfers((current) => current.map((transfer) => (
      !appId
      || appId === 'transferCenter'
      || (appId === 'privateShare' && transfer.mode === 'private')
      || (appId === 'lanShare' && transfer.mode === 'lan')
        ? { ...transfer, viewed: true, requiresAction: false }
        : transfer
    )));
  }, []);

  const badgeCount = useCallback((appId: 'privateShare' | 'lanShare' | 'transferCenter') => {
    const transferCount = transfers.filter((transfer) => {
      const modeMatches = appId === 'transferCenter'
        || (appId === 'privateShare' && transfer.mode === 'private')
        || (appId === 'lanShare' && transfer.mode === 'lan');
      return modeMatches && (
        isActiveTransfer(transfer.status)
        || transfer.status === 'failed'
        || transfer.status === 'waiting-source'
        || (transfer.requiresAction && !transfer.viewed)
      );
    }).length;
    const notificationCount = notifications.filter((item) => (
      !item.read && (item.appId === appId || appId === 'transferCenter')
    )).length;
    return Math.min(99, Math.max(transferCount, notificationCount));
  }, [notifications, transfers]);

  const getInboxBlob = useCallback(async (item: ShareInboxItem) => {
    const blob = item.storage === 'opfs' && item.opfsName
      ? await getOpfsFile(item.opfsName)
      : item.blobId
        ? await getShareBlob(item.blobId)
        : null;
    return blob ? new File([blob], item.name, { type: item.type, lastModified: item.receivedAt }) : null;
  }, []);

  const downloadInboxItem = useCallback(async (item: ShareInboxItem) => {
    const file = await getInboxBlob(item);
    if (!file) throw new Error('local-file-missing');
    downloadBlob(file, item.name);
  }, [getInboxBlob]);

  const removeInboxItem = useCallback(async (item: ShareInboxItem) => {
    await deleteInboxItem(item);
    setInbox((current) => current.filter((entry) => entry.id !== item.id));
  }, []);

  const pinInboxItem = useCallback(async (item: ShareInboxItem, pinned: boolean) => {
    await setInboxPinned(item.id, pinned);
    setInbox((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      pinned,
      expiresAt: pinned ? Number.MAX_SAFE_INTEGER : inboxExpiryFor(),
    } : entry));
  }, []);

  const clearRoomHistory = useCallback(async (roomCode: string) => {
    await clearShareMessages(roomCode);
    setMessages((current) => ({ ...current, [roomCode]: [] }));
  }, []);

  const value = useMemo<ShareContextValue>(() => ({
    sessions,
    connectedPeers,
    messages,
    transfers,
    inbox,
    notifications,
    nickname,
    setNickname,
    createRoom,
    joinRoom,
    leaveRoom,
    sendText,
    sendFiles,
    acceptTransfer,
    rejectTransfer,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    retryTransfer,
    reselectTransferSource,
    approveMember,
    updateRoomSettings,
    requestBrowserNotifications,
    dismissNotification,
    markNotificationsRead,
    badgeCount,
    downloadInboxItem,
    removeInboxItem,
    pinInboxItem,
    clearRoomHistory,
    getInboxBlob,
  }), [
    acceptTransfer,
    approveMember,
    badgeCount,
    cancelTransfer,
    clearRoomHistory,
    connectedPeers,
    createRoom,
    dismissNotification,
    downloadInboxItem,
    getInboxBlob,
    inbox,
    joinRoom,
    leaveRoom,
    markNotificationsRead,
    messages,
    nickname,
    notifications,
    pauseTransfer,
    pinInboxItem,
    rejectTransfer,
    removeInboxItem,
    requestBrowserNotifications,
    reselectTransferSource,
    resumeTransfer,
    retryTransfer,
    sendFiles,
    sendText,
    sessions,
    setNickname,
    transfers,
    updateRoomSettings,
  ]);

  return <ShareContext.Provider value={value}>{children}</ShareContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useShare = () => {
  const value = useContext(ShareContext);
  if (!value) throw new Error('useShare must be used inside ShareProvider');
  return value;
};
