import React, { useEffect, useState } from 'react';
import { Check, Download, Loader2, X } from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { MediaTrack } from '../../../store/useStore';
import { useStore } from '../../../store/useStore';
import { DownloadOption, getDownloadOptions } from '../../../lib/musicSources';
import { getMediaBlob } from '../../../lib/mediaStore';
import { recordBlobDownload, safeFileName, startDownload } from '../../../lib/downloadManager';

const formatBytes = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Lets the visitor pick from the qualities the source really serves, then hands off to the download manager. */
export const DownloadSheet: React.FC<{ track: MediaTrack; onClose: () => void; onOpenDownloads: () => void }> = ({ track, onClose, onOpenDownloads }) => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const duration = useStore((state) => (state.media.currentTrackId === track.id ? state.media.duration : 0)) || track.duration || 0;
  const [options, setOptions] = useState<DownloadOption[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [started, setStarted] = useState(false);
  const baseName = safeFileName([track.title, track.artist].filter(Boolean).join(' - '), 'music');

  useEffect(() => {
    if (track.blobId) return undefined;
    const controller = new AbortController();
    // A cancelled probe (closed sheet, React re-running the effect) must not overwrite a newer result.
    void getDownloadOptions(track, duration, controller.signal)
      .then((found) => { if (!controller.signal.aborted) setOptions(found); })
      .catch(() => { if (!controller.signal.aborted) setOptions([]); });
    return () => controller.abort();
  }, [duration, track]);

  const download = async () => {
    if (track.blobId) {
      const blob = await getMediaBlob(track.blobId);
      if (blob) recordBlobDownload(track.fileName || `${baseName}.${blob.type.includes('mpeg') ? 'mp3' : 'audio'}`, blob, 'music', { detail: zh ? '本地音频' : 'Local audio' });
      setStarted(true);
      return;
    }
    const option = options?.[selected];
    if (!option) return;
    setStarted(true);
    void startDownload({
      url: option.url,
      name: `${baseName}.${option.format.toLowerCase()}`,
      source: 'music',
      expectedSize: option.size,
      type: option.mime,
      detail: `${option.format}${option.kbps ? ` · ${option.kbps} kbps` : ''} · ${option.label[language]}`,
    });
  };

  return (
    <div className="absolute inset-0 z-[130] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-[#1d1d1f] shadow-2xl dark:bg-[#2c2c2e] dark:text-white" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold">{zh ? '下载歌曲' : 'Download song'}</h3>
            <p className="truncate text-xs opacity-60">{track.title}{track.artist ? ` · ${track.artist}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={zh ? '关闭' : 'Close'} className="rounded-full p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>

        {started ? (
          <div className="py-5 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#e1f3ed] text-[#0d8064]"><Check size={20} /></div>
            <p className="text-sm font-medium">{zh ? '已开始下载' : 'Download started'}</p>
            <p className="mt-1 text-xs opacity-60">{zh ? '完成后会自动保存到浏览器的下载位置。' : 'It will be saved to your browser’s download folder when done.'}</p>
            <button type="button" onClick={onOpenDownloads} className="mt-3 rounded-full bg-[#1a7cf5] px-4 py-1.5 text-xs font-semibold text-white">{zh ? '查看下载' : 'Open Downloads'}</button>
          </div>
        ) : track.blobId ? (
          <button type="button" onClick={() => void download()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#fa233b] py-2.5 text-sm font-semibold text-white"><Download size={15} />{zh ? '保存原文件' : 'Save original file'}</button>
        ) : options === null ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs opacity-60"><Loader2 size={14} className="animate-spin" />{zh ? '正在查看音源提供的音质…' : 'Checking available qualities…'}</div>
        ) : options.length === 0 ? (
          <p className="py-5 text-center text-xs leading-relaxed opacity-70">{zh ? '这个音源没有提供可下载的文件，或这首歌受版权限制。' : 'This source offers no downloadable file for this song, or it is rights-restricted.'}</p>
        ) : (
          <>
            <ul className="mt-3 space-y-1.5">
              {options.map((option, index) => (
                <li key={option.url}>
                  <button type="button" onClick={() => setSelected(index)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selected === index ? 'border-[#fa233b] bg-[#fa233b]/5' : 'border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/5'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected === index ? 'border-[#fa233b] bg-[#fa233b] text-white' : 'border-black/25 dark:border-white/30'}`}>{selected === index && <Check size={10} strokeWidth={3} />}</span>
                    <span className="flex-1 text-sm font-medium">{option.label[language]}</span>
                    <span className="text-xs tabular-nums opacity-60">{option.format}{option.kbps ? ` · ${option.kbps} kbps` : ''} · {formatBytes(option.size)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {options.length === 1 && <p className="mt-2 text-[11px] opacity-50">{zh ? '这个音源只提供这一种音质。' : 'This source provides a single quality.'}</p>}
            <button type="button" onClick={() => void download()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#fa233b] py-2.5 text-sm font-semibold text-white hover:brightness-105"><Download size={15} />{zh ? '下载' : 'Download'}</button>
          </>
        )}
        <p className="mt-3 text-center text-[10px] leading-relaxed opacity-45">{zh ? '支持正版音乐：请只下载你有权保存的歌曲。' : 'Support artists: only download music you have the right to keep.'}</p>
      </div>
    </div>
  );
};
