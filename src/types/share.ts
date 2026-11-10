export type ShareMode = 'private' | 'lan';

export type ShareConnectionState =
  | 'idle'
  | 'creating'
  | 'joining'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type ShareMemberStatus = 'pending' | 'active' | 'offline';

export interface ShareMember {
  id: string;
  nickname: string;
  status: ShareMemberStatus;
  isHost: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface ShareRoomSettings {
  approvalRequired: boolean;
  maxMembers: number;
  fileRecipients: 'selected' | 'everyone';
}

export interface ShareRoomSession {
  code: string;
  mode: ShareMode;
  signalCursor: number;
  memberId: string;
  memberSecret: string;
  nickname: string;
  isHost: boolean;
  hostMemberId: string;
  state: ShareConnectionState;
  createdAt: number;
  expiresAt: number;
  settings: ShareRoomSettings;
  members: ShareMember[];
  error?: string;
}

export type ShareMessageKind = 'text' | 'link' | 'file' | 'image' | 'audio' | 'video' | 'system';

export interface ShareFileDescriptor {
  id: string;
  transferId: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  fingerprint: string;
  senderId: string;
  senderName: string;
}

export interface ShareMessage {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  kind: ShareMessageKind;
  text?: string;
  file?: ShareFileDescriptor;
  createdAt: number;
  localOnly?: boolean;
}

export type ShareTransferStatus =
  | 'pending'
  | 'queued'
  | 'connecting'
  | 'transferring'
  | 'paused'
  | 'waiting-source'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ShareTransfer {
  id: string;
  roomCode: string;
  mode: ShareMode;
  direction: 'send' | 'receive';
  file: ShareFileDescriptor;
  peerId: string;
  peerName: string;
  status: ShareTransferStatus;
  transferredBytes: number;
  speed: number;
  etaSeconds: number | null;
  createdAt: number;
  updatedAt: number;
  error?: string;
  requiresAction?: boolean;
  pinned?: boolean;
  viewed?: boolean;
  storage?: 'memory' | 'indexeddb' | 'opfs';
}

export type LiuNotificationKind = 'info' | 'member' | 'transfer' | 'warning' | 'error';

export interface LiuNotification {
  id: string;
  kind: LiuNotificationKind;
  title: string;
  body: string;
  appId: 'privateShare' | 'lanShare' | 'transferCenter';
  createdAt: number;
  read: boolean;
  actionLabel?: string;
  actionId?: string;
}

export interface ShareInboxItem {
  id: string;
  roomCode: string;
  mode: ShareMode;
  name: string;
  type: string;
  size: number;
  senderName: string;
  receivedAt: number;
  expiresAt: number;
  pinned: boolean;
  storage: 'indexeddb' | 'opfs';
  blobId?: string;
  opfsName?: string;
  previewKind: 'image' | 'audio' | 'video' | 'pdf' | 'office' | 'text' | 'archive' | 'download';
}

export interface ShareRoomCreateOptions {
  code?: string;
  nickname: string;
  approvalRequired: boolean;
  maxMembers: number;
}

export interface ShareRoomJoinOptions {
  code: string;
  nickname: string;
}
