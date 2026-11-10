import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Download,
  FileBox,
  Pause,
  Pin,
  PinOff,
  Play,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useShare } from '../../share/ShareProvider';
import type { ShareInboxItem, ShareTransfer, ShareTransferStatus } from '../../types/share';
import { useI18n } from '../../i18n';
import { shareErrorText } from '../../lib/shareErrors';
import { ShareFilePreview } from '../share/ShareFilePreview';

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
};

const formatSpeed = (speed: number) => speed > 0 ? `${formatBytes(speed)}/s` : '—';

const statusText = (status: ShareTransferStatus, language: 'zh' | 'en') => {
  const labels: Record<ShareTransferStatus, [string, string]> = {
    pending: ['等待接收', 'Waiting'],
    queued: ['排队中', 'Queued'],
    connecting: ['连接中', 'Connecting'],
    transferring: ['传输中', 'Transferring'],
    paused: ['已暂停', 'Paused'],
    'waiting-source': ['等待重新选择源文件', 'Source File Required'],
    completed: ['已完成', 'Completed'],
    failed: ['失败', 'Failed'],
    cancelled: ['已取消', 'Cancelled'],
  };
  return labels[status][language === 'zh' ? 0 : 1];
};

const TransferRow: React.FC<{
  transfer: ShareTransfer;
  language: 'zh' | 'en';
  onAccept: () => void;
  onReject: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onReselect: (file: File) => void;
}> = ({
  transfer,
  language,
  onAccept,
  onReject,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onReselect,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const progress = transfer.file.size > 0
    ? Math.min(100, (transfer.transferredBytes / transfer.file.size) * 100)
    : 0;
  const incoming = transfer.direction === 'receive';
  const canPause = transfer.status === 'transferring';
  const canResume = transfer.status === 'paused';
  const canRetry = transfer.status === 'failed' || transfer.status === 'connecting';

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#dff3ed] text-[#0b7d62] dark:bg-[#17483b] dark:text-[#7ee0c5]">
          <FileBox size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm">{transfer.file.name}</strong>
          <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
            {incoming
              ? `${language === 'zh' ? '来自' : 'From'} ${transfer.peerName}`
              : `${language === 'zh' ? '发送给' : 'To'} ${transfer.peerName}`}
            {' · '}{formatBytes(transfer.file.size)}
          </span>
        </span>
        <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${
          transfer.status === 'failed'
            ? 'bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-300'
            : transfer.status === 'completed'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
        }`}>
          {statusText(transfer.status, language)}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className="h-full rounded-full bg-[#17b890] transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums text-slate-400">
        <span>{formatBytes(transfer.transferredBytes)} / {formatBytes(transfer.file.size)}</span>
        <span>{formatSpeed(transfer.speed)}{transfer.etaSeconds ? ` · ${transfer.etaSeconds}s` : ''}</span>
      </div>
      {transfer.error && <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">{shareErrorText(transfer.error, language)}</p>}

      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
        {transfer.status === 'pending' && incoming && (
          <>
            <button type="button" onClick={onReject} className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">{language === 'zh' ? '拒绝' : 'Decline'}</button>
            <button type="button" onClick={onAccept} className="rounded-md bg-[#17b890] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#119b78]">{language === 'zh' ? '接收' : 'Receive'}</button>
          </>
        )}
        {canPause && <button type="button" onClick={onPause} title={language === 'zh' ? '暂停' : 'Pause'} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"><Pause size={15} /></button>}
        {canResume && <button type="button" onClick={onResume} title={language === 'zh' ? '继续' : 'Resume'} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"><Play size={15} /></button>}
        {canRetry && <button type="button" onClick={onRetry} title={language === 'zh' ? '重试' : 'Retry'} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"><RefreshCw size={15} /></button>}
        {transfer.status === 'waiting-source' && transfer.direction === 'send' && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onReselect(file);
                event.currentTarget.value = '';
              }}
            />
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-md bg-[#17b890] px-3 py-1.5 text-xs font-semibold text-white">
              {language === 'zh' ? '重新选择原文件' : 'Select Source Again'}
            </button>
          </>
        )}
        {!['completed', 'cancelled'].includes(transfer.status) && (
          <button type="button" onClick={onCancel} title={language === 'zh' ? '取消' : 'Cancel'} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-400/10"><X size={15} /></button>
        )}
      </div>
    </article>
  );
};

export const TransferCenterApp: React.FC = () => {
  const {
    transfers,
    inbox,
    acceptTransfer,
    rejectTransfer,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    retryTransfer,
    reselectTransferSource,
    requestBrowserNotifications,
    markNotificationsRead,
    downloadInboxItem,
    removeInboxItem,
    pinInboxItem,
    getInboxBlob,
  } = useShare();
  const { language } = useI18n();
  const [tab, setTab] = useState<'tasks' | 'inbox'>('tasks');
  const [selected, setSelected] = useState<ShareInboxItem | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    markNotificationsRead('transferCenter');
  }, [markNotificationsRead]);

  useEffect(() => {
    if (selected && !inbox.some((item) => item.id === selected.id)) setSelected(null);
  }, [inbox, selected]);

  const activeCount = useMemo(() => transfers.filter((transfer) => (
    ['pending', 'queued', 'connecting', 'transferring', 'paused', 'waiting-source', 'failed'].includes(transfer.status)
  )).length, [transfers]);

  const receive = async (transfer: ShareTransfer) => {
    if (transfer.file.size > 10 * 1024 ** 3) {
      const confirmed = window.confirm(language === 'zh'
        ? '这个文件超过 10GB。请确认设备剩余空间充足，并保持网页与网络在线。仍要继续吗？'
        : 'This file is larger than 10GB. Make sure the device has enough space and keep the page online. Continue?');
      if (!confirmed) return;
    }
    try {
      await acceptTransfer(transfer.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'receive-failed');
    }
  };

  return (
    <div data-window-interactive="true" className="flex h-full min-h-0 select-text flex-col overflow-hidden bg-[#f4f7f6] text-slate-800 dark:bg-[#1b1c1d] dark:text-slate-100">
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
        <button type="button" onClick={() => setTab('tasks')} className={`rounded-md px-3 py-2 text-xs font-semibold ${tab === 'tasks' ? 'bg-[#17b890] text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}>
          {language === 'zh' ? `传输任务 ${activeCount ? `(${activeCount})` : ''}` : `Transfers ${activeCount ? `(${activeCount})` : ''}`}
        </button>
        <button type="button" onClick={() => setTab('inbox')} className={`rounded-md px-3 py-2 text-xs font-semibold ${tab === 'inbox' ? 'bg-[#17b890] text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}>
          {language === 'zh' ? `本地收件箱 (${inbox.length})` : `Local Inbox (${inbox.length})`}
        </button>
        <button
          type="button"
          title={language === 'zh' ? '开启浏览器通知' : 'Enable browser notifications'}
          onClick={() => void requestBrowserNotifications().then((permission) => setNotice(
            permission === 'granted'
              ? (language === 'zh' ? '浏览器通知已开启' : 'Browser notifications enabled')
              : (language === 'zh' ? '仍会使用 Liu OS 站内通知' : 'Liu OS notifications remain available'),
          ))}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <Bell size={17} />
        </button>
      </header>
      {notice && <button type="button" onClick={() => setNotice('')} className="shrink-0 bg-amber-50 px-3 py-2 text-left text-xs text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">{shareErrorText(notice, language)}</button>}

      {tab === 'tasks' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mx-auto max-w-3xl space-y-3">
            {transfers.length ? transfers.map((transfer) => (
              <TransferRow
                key={transfer.id}
                transfer={transfer}
                language={language}
                onAccept={() => void receive(transfer)}
                onReject={() => rejectTransfer(transfer.id)}
                onPause={() => pauseTransfer(transfer.id)}
                onResume={() => resumeTransfer(transfer.id)}
                onCancel={() => cancelTransfer(transfer.id)}
                onRetry={() => retryTransfer(transfer.id)}
                onReselect={(file) => void reselectTransferSource(transfer.id, file).then((matches) => {
                  if (!matches) setNotice(language === 'zh' ? '请选择与原任务完全相同的文件。' : 'Choose the exact original file.');
                  else resumeTransfer(transfer.id);
                })}
              />
            )) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-slate-400">
                <FileBox size={36} />
                <p className="mt-3 text-sm">{language === 'zh' ? '暂无传输任务' : 'No transfer tasks'}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside className={`${selected ? 'hidden sm:block' : 'block'} min-h-0 w-full shrink-0 overflow-y-auto border-r border-slate-200 p-3 dark:border-white/10 sm:w-72`}>
            <p className="mb-3 text-[11px] leading-5 text-slate-400">
              {language === 'zh' ? '未固定文件将在接收 7 天后自动清理，清理前一天会提醒。' : 'Unpinned files are cleared after 7 days with a one-day reminder.'}
            </p>
            <div className="space-y-2">
              {inbox.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelected(item)} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[#9dc5bb] dark:border-white/10 dark:bg-white/[0.05]">
                  <FileBox size={18} className="shrink-0 text-[#0e8f70]" />
                  <span className="min-w-0 flex-1"><strong className="block truncate text-xs">{item.name}</strong><span className="mt-0.5 block text-[10px] text-slate-400">{formatBytes(item.size)} · {item.senderName}</span></span>
                  {item.pinned && <Pin size={13} className="shrink-0 text-[#17b890]" />}
                </button>
              ))}
              {!inbox.length && <p className="py-14 text-center text-sm text-slate-400">{language === 'zh' ? '收件箱为空' : 'Inbox is empty'}</p>}
            </div>
          </aside>
          <main className={`${selected ? 'flex' : 'hidden sm:flex'} min-h-0 min-w-0 flex-1 flex-col`}>
            {selected ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
                  <button type="button" onClick={() => setSelected(null)} className="rounded-md px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-white/10 sm:hidden">
                    {language === 'zh' ? '返回' : 'Back'}
                  </button>
                  <strong className="min-w-0 flex-1 truncate text-sm">{selected.name}</strong>
                  <button type="button" title={language === 'zh' ? '下载原文件' : 'Download original'} onClick={() => void downloadInboxItem(selected)} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"><Download size={16} /></button>
                  <button type="button" title={selected.pinned ? (language === 'zh' ? '取消固定' : 'Unpin') : (language === 'zh' ? '固定保留' : 'Pin')} onClick={() => void pinInboxItem(selected, !selected.pinned)} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10">{selected.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
                  <button type="button" title={language === 'zh' ? '删除' : 'Delete'} onClick={() => void removeInboxItem(selected)} className="rounded-md p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-400/10"><Trash2 size={16} /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ShareFilePreview item={selected} getFile={getInboxBlob} />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{language === 'zh' ? '选择文件进行预览' : 'Choose a file to preview'}</div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};
