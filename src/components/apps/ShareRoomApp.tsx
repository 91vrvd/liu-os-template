import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Bell,
  Check,
  ChevronLeft,
  Copy,
  FilePlus2,
  Link2,
  LockKeyhole,
  Mic,
  MicOff,
  Pause,
  Play,
  QrCode as QrCodeIcon,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { shareErrorText } from '../../lib/shareErrors';
import { useShare } from '../../share/ShareProvider';
import type { ShareMember, ShareMode, ShareRoomSettings } from '../../types/share';
import { useStore } from '../../store/useStore';
import { LanShareIcon, PrivateShareIcon } from '../layout/ShareAppIcons';

interface ShareRoomAppProps {
  mode: ShareMode;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
};

const roomStatusLabel = (
  state: string,
  mode: ShareMode,
  language: 'zh' | 'en',
) => {
  if (state === 'connected') {
    return mode === 'lan'
      ? (language === 'zh' ? '房间已就绪，等待局域网设备' : 'Room ready; waiting for a LAN device')
      : (language === 'zh' ? '私密房间已就绪' : 'Private room ready');
  }
  if (state === 'joining') return language === 'zh' ? '等待房主确认' : 'Waiting for host approval';
  if (state === 'reconnecting') return language === 'zh' ? '正在重新连接' : 'Reconnecting';
  if (state === 'error') return language === 'zh' ? '连接出现问题' : 'Connection issue';
  return language === 'zh' ? '正在连接' : 'Connecting';
};

const QrCode: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, value, {
      width: 168,
      margin: 1,
      color: { dark: '#082d0f', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  }, [value]);
  return <div className="rounded-xl bg-white p-2 shadow-sm"><canvas ref={canvasRef} aria-label={label} className="h-auto w-full" /></div>;
};

const MemberRow: React.FC<{
  member: ShareMember;
  language: 'zh' | 'en';
  currentMemberId: string;
  selected: boolean;
  onToggle: () => void;
  onApprove: (approved: boolean) => void;
}> = ({ member, language, currentMemberId, selected, onToggle, onApprove }) => (
  <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${member.status === 'active' ? 'bg-emerald-500' : member.status === 'pending' ? 'bg-amber-500' : 'bg-slate-300'}`} />
    <span className="min-w-0 flex-1">
      <strong className="block truncate text-xs font-medium">{member.nickname}</strong>
      <span className="text-[10px] text-slate-400">
        {member.id === currentMemberId
          ? (language === 'zh' ? '本机' : 'This device')
          : member.isHost
            ? (language === 'zh' ? '房主' : 'Host')
            : member.status === 'pending'
              ? (language === 'zh' ? '等待批准' : 'Pending')
              : (language === 'zh' ? '在线' : 'Online')}
      </span>
    </span>
    {member.status === 'pending' ? (
      <span className="flex gap-1">
        <button type="button" aria-label={language === 'zh' ? '批准' : 'Approve'} onClick={() => onApprove(true)} className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-400/10"><UserCheck size={15} /></button>
        <button type="button" aria-label={language === 'zh' ? '拒绝' : 'Decline'} onClick={() => onApprove(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-400/10"><UserX size={15} /></button>
      </span>
    ) : member.id !== currentMemberId ? (
      <button type="button" aria-label={language === 'zh' ? '选择收件人' : 'Select recipient'} onClick={onToggle} className={`flex h-8 w-8 items-center justify-center rounded-md border ${selected ? 'border-[#17b890] bg-[#17b890] text-white' : 'border-slate-200 text-transparent dark:border-white/10'}`}><Check size={14} /></button>
    ) : null}
  </div>
);

export const ShareRoomApp: React.FC<ShareRoomAppProps> = ({ mode }) => {
  const {
    sessions,
    connectedPeers,
    messages,
    transfers,
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
    approveMember,
    updateRoomSettings,
    requestBrowserNotifications,
    clearRoomHistory,
  } = useShare();
  const { language } = useI18n();
  const closeApp = useStore((state) => state.closeApp);
  const appId = 'lanShare' as const;
  const session = sessions[mode];
  const sessionCode = session?.code;
  const roomMessages = session ? messages[session.code] ?? [] : [];
  const roomTransfers = session ? transfers.filter((transfer) => transfer.roomCode === session.code) : [];
  const [joinCode, setJoinCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [draft, setDraft] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [notice, setNotice] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const joinLinkAttemptRef = useRef('');

  const codeLength = mode === 'private' ? 4 : 6;
  const maxMembers = mode === 'private' ? 8 : 20;
  const activeMembers = session?.members.filter((member) => member.status === 'active') ?? [];
  const remoteMembers = activeMembers.filter((member) => member.id !== session?.memberId);
  const connectedMemberIds = connectedPeers[mode].filter((peerId) => (
    remoteMembers.some((member) => member.id === peerId)
  ));
  const connectedRemoteCount = connectedMemberIds.length;
  const canSendText = mode === 'private'
    ? remoteMembers.length > 0
    : connectedRemoteCount > 0;
  const remoteMemberIds = remoteMembers.map((member) => member.id).join('|');
  const activeRoomTransfers = roomTransfers.filter((transfer) => (
    ['pending', 'queued', 'connecting', 'transferring', 'paused', 'waiting-source'].includes(transfer.status)
  ));

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('share') !== mode) return;
    const targetCode = (url.searchParams.get('code') ?? '').replace(/\D/g, '').slice(0, codeLength);
    if (targetCode.length !== codeLength) return;
    setJoinCode(targetCode);

    const attemptKey = `${mode}:${targetCode}`;
    const clearJoinParams = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('share');
      nextUrl.searchParams.delete('code');
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    };
    if (sessionCode === targetCode && session?.state !== 'error') {
      joinLinkAttemptRef.current = attemptKey;
      clearJoinParams();
      return;
    }
    if (joinLinkAttemptRef.current === attemptKey) return;
    joinLinkAttemptRef.current = attemptKey;
    setNotice(language === 'zh' ? `正在加入房间 ${targetCode}…` : `Joining room ${targetCode}…`);

    void (async () => {
      try {
        if (sessionCode) {
          const left = await leaveRoom(mode);
          if (!left) throw new Error('active-transfer-switch-blocked');
        }
        await joinRoom(mode, { code: targetCode, nickname });
        clearJoinParams();
        setNotice(language === 'zh' ? `已加入房间 ${targetCode}` : `Joined room ${targetCode}`);
      } catch (error) {
        joinLinkAttemptRef.current = '';
        setNotice(error instanceof Error ? error.message : 'room-join-failed');
      }
    })();
  }, [
    codeLength,
    joinRoom,
    language,
    leaveRoom,
    mode,
    nickname,
    sessionCode,
    session?.state,
  ]);

  useEffect(() => {
    if (!sessionCode) return;
    const available = remoteMemberIds ? remoteMemberIds.split('|') : [];
    setSelectedRecipients((current) => {
      const retained = current.filter((memberId) => available.includes(memberId));
      const next = retained.length ? retained : available;
      const unchanged = next.length === current.length
        && next.every((memberId, index) => memberId === current[index]);
      return unchanged ? current : next;
    });
  }, [remoteMemberIds, sessionCode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [roomMessages.length]);

  useEffect(() => {
    if (mode !== 'lan' || !session?.isHost || session.state !== 'connected') return undefined;
    let lock: { release: () => Promise<void> } | null = null;
    const wakeLock = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    void wakeLock.wakeLock?.request('screen').then((nextLock) => {
      lock = nextLock;
    }).catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, [mode, session?.isHost, session?.state]);

  const create = async () => {
    setNotice('');
    try {
      await createRoom(mode, {
        code: useCustomCode ? customCode : undefined,
        nickname,
        approvalRequired,
        maxMembers,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'room-create-failed');
    }
  };

  const join = async () => {
    setNotice('');
    if (joinCode.length !== codeLength) {
      setNotice(language === 'zh' ? `请输入 ${codeLength} 位房间码。` : `Enter the ${codeLength}-digit room code.`);
      return;
    }
    try {
      await joinRoom(mode, { code: joinCode, nickname });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'room-join-failed');
    }
  };

  const sendDraft = async () => {
    if (!draft.trim()) return;
    setNotice('');
    try {
      await sendText(mode, draft);
      setDraft('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'peer-not-connected');
    }
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    if (!connectedMemberIds.length) {
      setNotice(language === 'zh'
        ? `还没有设备通过直连验证。请确认双方都在房间 ${session?.code ?? ''}。`
        : `No verified direct connection yet. Make sure both devices are in room ${session?.code ?? ''}.`);
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 ** 3)) {
      const confirmed = window.confirm(language === 'zh'
        ? '所选文件中有超过 10GB 的内容。系统不会压缩或限制，但请确认双方空间充足并保持网页在线。继续发送吗？'
        : 'Some files exceed 10GB. They will not be compressed or blocked, but both devices need enough storage and must stay online. Continue?');
      if (!confirmed) return;
    }
    try {
      const connectedRecipients = selectedRecipients.filter((memberId) => connectedMemberIds.includes(memberId));
      await sendFiles(mode, files, connectedRecipients.length ? connectedRecipients : connectedMemberIds);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'send-files-failed');
    }
  };

  const acceptIncomingTransfer = async (transferId: string, fileSize: number) => {
    if (fileSize > 10 * 1024 ** 3) {
      const confirmed = window.confirm(language === 'zh'
        ? '这个文件超过 10GB。请确认当前设备剩余空间充足，并保持网页和网络在线。仍要接收吗？'
        : 'This file is larger than 10GB. Make sure this device has enough space and keep the page and network online. Continue?');
      if (!confirmed) return;
    }
    try {
      await acceptTransfer(transferId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'receive-failed');
    }
  };

  const startVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice(language === 'zh' ? '当前浏览器不支持录制语音。' : 'Voice recording is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type: mime });
        const extension = mime.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: mime, lastModified: Date.now() });
        void addFiles([file]);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
    } catch {
      setNotice(language === 'zh' ? '没有获得麦克风权限。' : 'Microphone permission was not granted.');
    }
  };

  const stopVoice = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const requestLeave = async () => {
    const left = await leaveRoom(mode);
    if (!left) {
      setLeavePrompt(true);
      return;
    }
    setShowMembers(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    void addFiles(event.dataTransfer.files);
  };

  const roomLink = session
    ? `${window.location.origin}${window.location.pathname}?share=${mode}&code=${session.code}`
    : '';

  if (!session || session.state === 'error') {
    return (
      <div data-window-interactive="true" className="flex h-full min-h-0 select-text flex-col overflow-y-auto bg-[#f5f8f6] text-slate-800 dark:bg-[#191b1b] dark:text-slate-100">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center p-5 sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            {mode === 'private' ? <PrivateShareIcon className="h-16 w-16 shrink-0" /> : <LanShareIcon className="h-16 w-16 shrink-0" />}
            <div>
              <h1 className="text-2xl font-semibold">{mode === 'private' ? (language === 'zh' ? '密传' : 'Private Share') : (language === 'zh' ? '局域传送' : 'LAN Transfer')}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {mode === 'private'
                  ? (language === 'zh' ? '用四位房间码在设备之间直接传送原文件。' : 'Send original files directly with a four-digit room code.')
                  : (language === 'zh' ? '在同一网络的设备之间点对点发送原文件。' : 'Send original files peer-to-peer between devices on the same network.')}
              </p>
            </div>
          </div>

          {session?.error && <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">{shareErrorText(session.error, language)}</div>}
          {notice && <button type="button" onClick={() => setNotice('')} className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">{shareErrorText(notice, language)}</button>}

          <label className="mb-5 block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">{language === 'zh' ? '你的昵称' : 'Your nickname'}</span>
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={32} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#17b890] dark:border-white/10 dark:bg-white/[0.06]" />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
              <div className="flex items-center gap-2"><LockKeyhole size={18} className="text-[#0e8f70]" /><h2 className="font-semibold">{language === 'zh' ? '创建房间' : 'Create a room'}</h2></div>
              <label className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span>{language === 'zh' ? '自定义房间码' : 'Custom room code'}</span>
                <input type="checkbox" checked={useCustomCode} onChange={(event) => setUseCustomCode(event.target.checked)} className="h-4 w-4 accent-[#17b890]" />
              </label>
              {useCustomCode && <input inputMode="numeric" value={customCode} onChange={(event) => setCustomCode(event.target.value.replace(/\D/g, '').slice(0, codeLength))} placeholder={`${codeLength} ${language === 'zh' ? '位数字' : 'digits'}`} className="mt-3 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-center text-lg tracking-[0.35em] outline-none focus:border-[#17b890] dark:border-white/10 dark:bg-black/20" />}
              <label className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span>{language === 'zh' ? '新成员需要批准' : 'Approve new members'}</span>
                <input type="checkbox" checked={approvalRequired} onChange={(event) => setApprovalRequired(event.target.checked)} className="h-4 w-4 accent-[#17b890]" />
              </label>
              <button type="button" onClick={() => void create()} className="mt-5 h-11 w-full rounded-lg bg-[#17b890] text-sm font-semibold text-white hover:bg-[#119b78]">
                {language === 'zh' ? '创建并进入' : 'Create and Enter'}
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
              <div className="flex items-center gap-2"><Users size={18} className="text-[#0e8f70]" /><h2 className="font-semibold">{language === 'zh' ? '加入房间' : 'Join a room'}</h2></div>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, codeLength))}
                placeholder={`${codeLength} ${language === 'zh' ? '位房间码' : 'digit room code'}`}
                className="mt-4 h-14 w-full rounded-lg border border-slate-200 bg-white px-3 text-center text-2xl font-semibold tracking-[0.35em] outline-none focus:border-[#17b890] dark:border-white/10 dark:bg-black/20"
              />
              <button type="button" onClick={() => void join()} className="mt-5 h-11 w-full rounded-lg border border-[#17b890] text-sm font-semibold text-[#0e8f70] hover:bg-[#e7f7f2] dark:text-[#78ddc2] dark:hover:bg-[#17b890]/10">
                {language === 'zh' ? '加入房间' : 'Join Room'}
              </button>
              <p className="mt-4 text-[11px] leading-5 text-slate-400">
                {language === 'zh'
                  ? mode === 'lan'
                    ? '两台设备需连接同一网络并加入同一个房间码。服务器只负责配对，文件通过 WebRTC 点对点传输。'
                    : '房间码只用于匹配设备。内容不上传云端；异常扫描会被限速和拦截。'
                  : mode === 'lan'
                    ? 'Connect both devices to the same network and join the same room code. The server only pairs devices; files travel peer-to-peer over WebRTC.'
                    : 'The room code only matches devices. Content is never uploaded; abusive scans are rate-limited and blocked.'}
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-window-interactive="true"
      className="relative flex h-full min-h-0 select-text flex-col overflow-hidden bg-[#f5f8f6] text-slate-800 dark:bg-[#191b1b] dark:text-slate-100"
      onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-slate-200 bg-white/82 px-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-[#242626]/88 sm:gap-2 sm:px-4">
        <button type="button" onClick={() => void requestLeave()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10 sm:h-10 sm:w-10" title={language === 'zh' ? '离开房间' : 'Leave room'}><ChevronLeft size={20} /></button>
        {mode === 'private' ? <PrivateShareIcon className="hidden h-9 w-9 shrink-0 sm:block" /> : <LanShareIcon className="hidden h-9 w-9 shrink-0 sm:block" />}
        <span className="min-w-0 max-w-[5.75rem] sm:max-w-none">
          <strong className="block truncate text-xs sm:text-sm">{mode === 'private' ? (language === 'zh' ? '密传' : 'Private Share') : (language === 'zh' ? '局域传送' : 'LAN Transfer')}</strong>
          <span className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] text-slate-400">
            {connectedRemoteCount > 0 ? <Wifi size={11} /> : <WifiOff size={11} />}
            {remoteMembers.length > 0
              ? connectedRemoteCount > 0
                ? mode === 'lan'
                  ? (language === 'zh' ? `${connectedRemoteCount} 台设备已连接` : `${connectedRemoteCount} device${connectedRemoteCount > 1 ? 's' : ''} connected`)
                  : (language === 'zh' ? `${connectedRemoteCount} 台设备已直连` : `${connectedRemoteCount} device${connectedRemoteCount > 1 ? 's' : ''} connected`)
                : mode === 'private'
                  ? (language === 'zh' ? '文字可发送，文件等待直连' : 'Text ready; files await direct connection')
                  : (language === 'zh' ? '正在建立点对点连接' : 'Establishing peer connection')
              : roomStatusLabel(session.state, mode, language)}
          </span>
        </span>
        <button
          type="button"
          title={language === 'zh' ? '房间码与二维码' : 'Room code and QR code'}
          onClick={() => {
            if (window.matchMedia('(max-width: 639px)').matches) {
              setShowQr(true);
              return;
            }
            void navigator.clipboard.writeText(session.code).then(() => setNotice(language === 'zh' ? '房间码已复制' : 'Room code copied'));
          }}
          className="ml-auto flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[#e3f4ef] px-2 text-xs font-semibold tracking-[0.12em] text-[#0b7d62] hover:bg-[#d4eee6] dark:bg-[#17483b] dark:text-[#80dfc6] sm:h-10 sm:gap-2 sm:px-3 sm:text-sm sm:tracking-[0.16em]"
        >
          {session.code}<Copy size={14} className="hidden sm:block" /><QrCodeIcon size={14} className="sm:hidden" />
        </button>
        <button type="button" onClick={() => setShowQr(true)} className="hidden h-10 w-10 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10 sm:flex" title={language === 'zh' ? '房间二维码' : 'Room QR code'}><QrCodeIcon size={18} /></button>
        <button type="button" onClick={() => setShowMembers(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10 sm:h-10 sm:w-10" title={language === 'zh' ? '成员' : 'Members'}><Users size={18} /></button>
        {session.isHost && <button type="button" onClick={() => setShowSettings(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10 sm:h-10 sm:w-10" title={language === 'zh' ? '房间设置' : 'Room settings'}><Settings2 size={18} /></button>}
      </header>

      {notice && <button type="button" onClick={() => setNotice('')} className="shrink-0 bg-amber-50 px-3 py-2 text-left text-xs text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">{shareErrorText(notice, language)}</button>}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.025] lg:block">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">{language === 'zh' ? '在线成员' : 'Members'}</h2><span className="text-[10px] text-slate-400">{activeMembers.length}/{session.settings.maxMembers}</span></div>
          <div className="space-y-0.5">
            {session.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                language={language}
                currentMemberId={session.memberId}
                selected={selectedRecipients.includes(member.id)}
                onToggle={() => setSelectedRecipients((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])}
                onApprove={(approved) => void approveMember(mode, member.id, approved)}
              />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-[#9dc5bb]/50 bg-[#e9f5f1] p-3 text-[10px] leading-5 text-[#356b5e] dark:bg-[#14342c] dark:text-[#9bcfc1]">
            <ShieldCheck size={15} className="mb-1" />
            {language === 'zh'
              ? mode === 'lan'
                ? '房间会校验两台设备是否处于同一网络；文件通过浏览器点对点传输，服务器不接收文件内容。'
                : '文件只在设备之间直传。直连不可用时，文字会加密后短时中继，并在几分钟内自动清理。'
              : mode === 'lan'
                ? 'The room checks that both devices use the same network. Files travel browser-to-browser; the server never receives file contents.'
                : 'Files move directly between devices. If direct text delivery fails, encrypted text is relayed briefly and cleared within minutes.'}
          </div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            <div className="mx-auto max-w-3xl space-y-3">
              <p className="py-2 text-center text-[10px] text-slate-400">
                {language === 'zh' ? '聊天记录保存在当前设备；文件原样传输，不进行压缩。' : 'Chat stays on this device. Files are transferred byte-for-byte without compression.'}
              </p>
              {remoteMembers.length === 0 && (
                <div className="rounded-xl border border-[#9dc5bb]/55 bg-[#edf7f4] px-4 py-3 text-center text-xs leading-6 text-[#356b5e] dark:border-[#17b890]/20 dark:bg-[#17b890]/10 dark:text-[#9bcfc1]">
                  {language === 'zh'
                    ? `正在等待另一台设备加入房间 ${session.code}。另一台设备请选择“加入房间”，不要再次创建新房间。`
                    : `Waiting for another device to join room ${session.code}. Choose “Join Room” on the other device instead of creating another room.`}
                </div>
              )}
              {remoteMembers.length > 0 && connectedRemoteCount === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs leading-6 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                  {mode === 'lan'
                    ? language === 'zh'
                      ? '双方已进入同一房间，但点对点通道尚未建立。请保持页面在线，并检查 VPN、访客网络隔离或浏览器本地网络权限。'
                      : 'Both devices are in the room, but the peer channel is not ready. Keep both pages open and check VPN, guest isolation, or local-network permission.'
                    : language === 'zh'
                      ? '双方已进入同一房间。文字现可通过加密短时中继送达；文件正在等待设备直连。'
                      : 'Both devices are in the same room. Text can use the encrypted short-lived relay; files are waiting for a direct connection.'}
                </div>
              )}
              {roomMessages.map((message) => {
                const own = message.senderId === session.memberId;
                if (message.kind === 'system') {
                  return <div key={message.id} className="text-center text-[10px] text-slate-400">{message.text}</div>;
                }
                return (
                  <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[86%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[70%] ${
                      own
                        ? 'rounded-br-md bg-[#17b890] text-white'
                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-100'
                    }`}>
                      {!own && <span className="mb-1 block text-[10px] font-semibold opacity-60">{message.senderName}</span>}
                      {message.text && (
                        message.kind === 'link'
                          ? <a href={message.text} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline underline-offset-2"><Link2 size={13} className="mr-1 inline" />{message.text}</a>
                          : <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                      )}
                      {message.file && <div className="flex min-w-48 items-center gap-2"><FilePlus2 size={20} /><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{message.file.name}</strong><span className="text-[10px] opacity-70">{formatBytes(message.file.size)}</span></span></div>}
                      <span className="mt-1 block text-right text-[9px] opacity-55">{new Date(message.createdAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    </div>
                  </div>
                );
              })}
              {roomTransfers.filter((transfer) => transfer.direction === 'receive' && transfer.status === 'pending').map((transfer) => (
                <div key={transfer.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                  <div className="flex items-center gap-2"><FilePlus2 size={19} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{transfer.file.name}</strong><span className="text-[10px] opacity-70">{formatBytes(transfer.file.size)} · {transfer.peerName}</span></span></div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => rejectTransfer(transfer.id)} className="rounded-md px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/10">{language === 'zh' ? '拒绝' : 'Decline'}</button>
                    <button type="button" onClick={() => void acceptIncomingTransfer(transfer.id, transfer.file.size)} className="rounded-md bg-[#17b890] px-3 py-1.5 text-xs font-semibold text-white">{language === 'zh' ? '接收原文件' : 'Receive Original'}</button>
                  </div>
                </div>
              ))}
              {activeRoomTransfers.filter((transfer) => transfer.status !== 'pending').slice(0, 4).map((transfer) => {
                const progress = transfer.file.size ? Math.min(100, transfer.transferredBytes / transfer.file.size * 100) : 0;
                return <div key={transfer.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.05]">
                  <div className="flex items-center gap-2"><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{transfer.file.name}</strong><span className="text-[10px] text-slate-400">{formatBytes(transfer.transferredBytes)} / {formatBytes(transfer.file.size)}</span></span>{transfer.status === 'transferring' ? <button type="button" onClick={() => pauseTransfer(transfer.id)} className="p-2"><Pause size={14} /></button> : transfer.status === 'paused' ? <button type="button" onClick={() => resumeTransfer(transfer.id)} className="p-2"><Play size={14} /></button> : null}<button type="button" onClick={() => cancelTransfer(transfer.id)} className="p-2 text-slate-400"><X size={14} /></button></div>
                  <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-[#17b890]" style={{ width: `${progress}%` }} /></div>
                </div>;
              })}
              <div ref={endRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white/88 px-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-white/10 dark:bg-[#242626]/92 sm:px-4">
            <div className="mx-auto flex max-w-3xl items-end gap-1.5">
              <label
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-within:ring-2 focus-within:ring-[#17b890]/55 dark:hover:bg-white/10"
                title={language === 'zh' ? '添加文件' : 'Add files'}
              >
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  aria-label={language === 'zh' ? '添加文件' : 'Add files'}
                  onChange={(event) => {
                    if (event.target.files) void addFiles(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
                <FilePlus2 size={20} />
              </label>
              <button type="button" onClick={() => recording ? stopVoice() : void startVoice()} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${recording ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`} title={language === 'zh' ? '录制语音' : 'Record voice'}>{recording ? <MicOff size={19} /> : <Mic size={19} />}</button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onPaste={(event) => {
                  if (!event.clipboardData.files.length) return;
                  event.preventDefault();
                  void addFiles(event.clipboardData.files);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendDraft();
                  }
                }}
                placeholder={language === 'zh' ? '输入消息，或把文件拖进这里…' : 'Message, or drop files here…'}
                rows={1}
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#17b890] dark:border-white/10 dark:bg-black/20"
              />
              <button type="button" onClick={() => void sendDraft()} disabled={!draft.trim() || !canSendText} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#17b890] text-white disabled:opacity-35"><Send size={18} /></button>
            </div>
          </div>
        </main>
      </div>

      {dragActive && <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-[#17b890] bg-[#e8f7f2]/92 text-center text-[#0b7d62] backdrop-blur"><div><FilePlus2 className="mx-auto" size={36} /><p className="mt-3 font-semibold">{language === 'zh' ? '松开即可发送原文件' : 'Drop to send original files'}</p></div></div>}

      {(showMembers || showSettings || showQr || leavePrompt) && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/20 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onPointerDown={(event) => { if (event.target === event.currentTarget) { setShowMembers(false); setShowSettings(false); setShowQr(false); setLeavePrompt(false); } }}>
          <section className="max-h-[86dvh] w-full overflow-y-auto rounded-t-2xl border border-white/60 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#262829] sm:max-w-md sm:rounded-2xl">
            <div className="mb-4 flex items-center"><h2 className="font-semibold">{showMembers ? (language === 'zh' ? '房间成员' : 'Room Members') : showSettings ? (language === 'zh' ? '房间设置' : 'Room Settings') : showQr ? (language === 'zh' ? '扫码加入' : 'Scan to Join') : (language === 'zh' ? '传输仍在进行' : 'Transfers are still active')}</h2><button type="button" onClick={() => { setShowMembers(false); setShowSettings(false); setShowQr(false); setLeavePrompt(false); }} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10"><X size={17} /></button></div>
            {showMembers && <div className="space-y-1">{session.members.map((member) => <MemberRow key={member.id} member={member} language={language} currentMemberId={session.memberId} selected={selectedRecipients.includes(member.id)} onToggle={() => setSelectedRecipients((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} onApprove={(approved) => void approveMember(mode, member.id, approved)} />)}</div>}
            {showSettings && <RoomSettingsForm language={language} settings={session.settings} maxLimit={maxMembers} onSave={(settings) => void updateRoomSettings(mode, settings).then(() => setShowSettings(false))} onNotifications={() => void requestBrowserNotifications()} onClear={() => void clearRoomHistory(session.code)} />}
            {showQr && <div className="mx-auto max-w-[220px] text-center"><QrCode value={roomLink} label={language === 'zh' ? '房间二维码' : 'Room QR code'} /><p className="mt-3 text-sm font-semibold tracking-[0.2em]">{session.code}</p><button type="button" onClick={() => void navigator.clipboard.writeText(roomLink)} className="mt-3 rounded-md bg-[#17b890] px-4 py-2 text-xs font-semibold text-white">{language === 'zh' ? '复制加入链接' : 'Copy Join Link'}</button></div>}
            {leavePrompt && <div className="space-y-2"><p className="mb-4 text-sm leading-6 text-slate-500 dark:text-slate-300">{language === 'zh' ? '关闭窗口不会停止任务。你也可以暂停或取消传输后离开房间。' : 'Closing the window keeps tasks running. You can also pause or cancel before leaving.'}</p><button type="button" onClick={() => { setLeavePrompt(false); closeApp(appId); }} className="h-11 w-full rounded-lg bg-[#17b890] text-sm font-semibold text-white">{language === 'zh' ? '继续在后台传输' : 'Continue in Background'}</button><button type="button" onClick={() => { activeRoomTransfers.forEach((transfer) => pauseTransfer(transfer.id)); void leaveRoom(mode, true); setLeavePrompt(false); }} className="h-11 w-full rounded-lg border border-slate-200 text-sm dark:border-white/10">{language === 'zh' ? '暂停并离开' : 'Pause and Leave'}</button><button type="button" onClick={() => { activeRoomTransfers.forEach((transfer) => cancelTransfer(transfer.id)); void leaveRoom(mode, true); setLeavePrompt(false); }} className="h-11 w-full rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-400/10">{language === 'zh' ? '取消传输并离开' : 'Cancel Transfers and Leave'}</button></div>}
          </section>
        </div>
      )}
    </div>
  );
};

const RoomSettingsForm: React.FC<{
  language: 'zh' | 'en';
  settings: ShareRoomSettings;
  maxLimit: number;
  onSave: (settings: ShareRoomSettings) => void;
  onNotifications: () => void;
  onClear: () => void;
}> = ({ language, settings, maxLimit, onSave, onNotifications, onClear }) => {
  const [draft, setDraft] = useState(settings);
  return <div className="space-y-4">
    <label className="flex items-center justify-between text-sm"><span>{language === 'zh' ? '新成员需要批准' : 'Approve new members'}</span><input type="checkbox" checked={draft.approvalRequired} onChange={(event) => setDraft((current) => ({ ...current, approvalRequired: event.target.checked }))} className="h-4 w-4 accent-[#17b890]" /></label>
    <label className="block text-sm"><span className="mb-1 block">{language === 'zh' ? '人数上限' : 'Member limit'}</span><input type="number" min={2} max={maxLimit} value={draft.maxMembers} onChange={(event) => setDraft((current) => ({ ...current, maxMembers: Math.max(2, Math.min(maxLimit, Number(event.target.value) || 2)) }))} className="h-10 w-full rounded-md border border-slate-200 px-3 dark:border-white/10 dark:bg-black/20" /></label>
    <label className="block text-sm"><span className="mb-1 block">{language === 'zh' ? '默认文件收件人' : 'Default file recipients'}</span><select value={draft.fileRecipients} onChange={(event) => setDraft((current) => ({ ...current, fileRecipients: event.target.value as ShareRoomSettings['fileRecipients'] }))} className="h-10 w-full rounded-md border border-slate-200 px-3 dark:border-white/10 dark:bg-black/20"><option value="selected">{language === 'zh' ? '选择的成员' : 'Selected members'}</option><option value="everyone">{language === 'zh' ? '所有成员' : 'Everyone'}</option></select></label>
    <button type="button" onClick={() => onSave(draft)} className="h-11 w-full rounded-lg bg-[#17b890] text-sm font-semibold text-white">{language === 'zh' ? '保存设置' : 'Save Settings'}</button>
    <button type="button" onClick={onNotifications} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm dark:border-white/10"><Bell size={16} />{language === 'zh' ? '开启浏览器通知' : 'Enable Browser Notifications'}</button>
    <button type="button" onClick={onClear} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-400/10"><Trash2 size={16} />{language === 'zh' ? '清除本机聊天记录' : 'Clear Local Chat History'}</button>
  </div>;
};

export const LanShareApp: React.FC = () => <ShareRoomApp mode="lan" />;
