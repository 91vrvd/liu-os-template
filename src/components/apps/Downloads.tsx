import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileArchive, FileAudio, FileImage, FileText, FolderOpen, Pause, Play, RotateCw, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { DownloadItem, useStore } from '../../store/useStore';
import { deleteDownloadRecord, getBlob, listDownloadRecords } from '../../lib/documentStore';
import { cancelDownload, saveBlobToDevice, startDownload } from '../../lib/downloadManager';

type Filter = 'all' | 'music' | 'docs' | 'images' | 'other';

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (timestamp: number, language: 'zh' | 'en') => new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);

const kindOf = (item: DownloadItem): Exclude<Filter, 'all'> => {
  if (item.source === 'music' || item.type.startsWith('audio/')) return 'music';
  if (item.type.startsWith('image/')) return 'images';
  if (item.source === 'notes' || /pdf|word|sheet|presentation|text|json|html|markdown/.test(item.type) || /^(pdf|docx?|xlsx?|pptx?|txt|md|json|html)$/.test(item.extension ?? '')) return 'docs';
  return 'other';
};

const KindIcon: React.FC<{ item: DownloadItem }> = ({ item }) => {
  const kind = kindOf(item);
  const Icon = kind === 'music' ? FileAudio : kind === 'images' ? FileImage : kind === 'docs' ? FileText : FileArchive;
  const color = kind === 'music' ? 'bg-rose-50 text-rose-500 dark:bg-rose-400/10 dark:text-rose-300' : kind === 'images' ? 'bg-violet-50 text-violet-500 dark:bg-violet-400/10 dark:text-violet-300' : kind === 'docs' ? 'bg-blue-50 text-blue-500 dark:bg-blue-400/10 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300';
  return <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}><Icon size={20} /></span>;
};

export const DownloadsApp: React.FC = () => {
  const { t, language } = useI18n();
  const zh = language === 'zh';
  const downloads = useStore((state) => state.downloads);
  const setDownloads = useStore((state) => state.setDownloads);
  const removeDownload = useStore((state) => state.removeDownload);
  const [filter, setFilter] = useState<Filter>('all');
  const [preview, setPreview] = useState<{ id: string; url: string; kind: 'audio' | 'image' } | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Merge records saved in IndexedDB (e.g. from another tab) with the live list.
  useEffect(() => {
    let active = true;
    void listDownloadRecords().then((records) => {
      if (!active || !records.length) return;
      const current = useStore.getState().downloads;
      const merged = [...current, ...records.filter((record) => !current.some((item) => item.id === record.id)) as DownloadItem[]]
        .sort((a, b) => b.createdAt - a.createdAt);
      setDownloads(merged);
    }).catch(() => undefined);
    void navigator.storage?.estimate?.().then((estimate) => {
      if (active && estimate.quota) setUsage({ used: estimate.usage ?? 0, quota: estimate.quota });
    });
    return () => { active = false; };
  }, [setDownloads]);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);

  const visible = useMemo(() => downloads.filter((item) => filter === 'all' || kindOf(item) === filter), [downloads, filter]);
  const activeCount = downloads.filter((item) => item.status === 'downloading').length;

  const blobFor = async (item: DownloadItem) => (item.blobId ? getBlob(item.blobId) : item.content ? new Blob([item.content], { type: item.type }) : null);

  const saveAgain = async (item: DownloadItem) => {
    const blob = await blobFor(item);
    if (blob) saveBlobToDevice(item.name, blob);
  };

  const togglePreview = async (item: DownloadItem) => {
    if (preview?.id === item.id) {
      setPreview(null);
      return;
    }
    const blob = await blobFor(item);
    if (!blob) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreview({ id: item.id, url, kind: kindOf(item) === 'music' ? 'audio' : 'image' });
  };

  const remove = (item: DownloadItem) => {
    if (item.status === 'downloading') cancelDownload(item.id);
    if (preview?.id === item.id) setPreview(null);
    removeDownload(item.id);
    void deleteDownloadRecord({ ...item, extension: item.extension ?? item.name.split('.').pop() ?? '' }).catch(() => undefined);
  };

  const retry = (item: DownloadItem) => {
    if (!item.sourceUrl) return;
    remove(item);
    void startDownload({ url: item.sourceUrl, name: item.name, source: item.source, type: item.type, detail: item.detail });
  };

  const clearFinished = () => downloads.filter((item) => item.status !== 'downloading').forEach(remove);

  const statusLine = (item: DownloadItem) => {
    if (item.status === 'downloading') {
      const pct = item.progress ? Math.round(item.progress * 100) : null;
      return `${zh ? '正在下载' : 'Downloading'} · ${formatBytes(item.received)}${item.size ? ` / ${formatBytes(item.size)}` : ''}${pct !== null ? ` · ${pct}%` : ''}`;
    }
    if (item.status === 'failed') {
      if (item.error === 'opened-in-tab') return zh ? '该地址不允许站内下载，已在新标签页打开' : 'This host blocks in-site downloads; opened in a new tab';
      if (item.error === 'interrupted') return zh ? '页面刷新时中断' : 'Interrupted by a page reload';
      return zh ? '下载失败' : 'Failed';
    }
    if (item.status === 'canceled') return zh ? '已取消' : 'Canceled';
    return [formatBytes(item.size), item.detail, formatDate(item.createdAt, language)].filter(Boolean).join(' · ');
  };

  const filters: { id: Filter; zh: string; en: string }[] = [
    { id: 'all', zh: '全部', en: 'All' },
    { id: 'music', zh: '音乐', en: 'Music' },
    { id: 'docs', zh: '文档', en: 'Documents' },
    { id: 'images', zh: '图片', en: 'Images' },
    { id: 'other', zh: '其他', en: 'Other' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f7] text-gray-900 transition-colors dark:bg-[#1c1c1e] dark:text-white">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-black/5 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white"><Download size={18} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold">{t('downloads.title')}</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeCount ? (zh ? `${activeCount} 个正在下载 · ` : `${activeCount} in progress · `) : ''}
            {zh ? '文件会同时保存到浏览器的下载位置' : 'Files are also saved to your browser’s download folder'}
            {usage ? ` · ${zh ? '本站已用' : 'Site storage'} ${formatBytes(usage.used)}` : ''}
          </p>
        </div>
        {downloads.some((item) => item.status !== 'downloading') && <button type="button" onClick={clearFinished} className="rounded-md px-2.5 py-1.5 text-xs text-slate-500 hover:bg-black/5 dark:hover:bg-white/10">{zh ? '清除记录' : 'Clear'}</button>}
      </header>

      <nav className="scrollbar-hide flex shrink-0 gap-1 overflow-x-auto px-4 py-2">
        {filters.map((item) => {
          const count = item.id === 'all' ? downloads.length : downloads.filter((download) => kindOf(download) === item.id).length;
          return (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${filter === item.id ? 'bg-[#1a7cf5] text-white' : 'bg-black/5 text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300'}`}>
              {zh ? item.zh : item.en}{count ? ` ${count}` : ''}
            </button>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <main className="m-4 mt-1 flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/70 p-8 text-center dark:border-white/10 dark:bg-white/5">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-blue-400/10 dark:text-blue-300"><FolderOpen size={34} /></div>
            <h2 className="text-lg font-semibold">{t('downloads.emptyTitle')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{zh ? '在音乐、备忘录等应用里下载或导出的文件都会出现在这里，可以再次保存、试听或预览。' : 'Files you download or export in Music, Notes and other apps appear here, ready to save again, play or preview.'}</p>
          </div>
        </main>
      ) : (
        <main className="custom-scrollbar mx-4 mb-4 mt-1 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white/80 p-1.5 dark:border-white/10 dark:bg-white/5">
          {visible.map((item) => {
            const done = !item.status || item.status === 'done';
            const canPreview = done && Boolean(item.blobId) && (kindOf(item) === 'music' || kindOf(item) === 'images');
            return (
              <article key={item.id} className="rounded-xl p-2.5 transition hover:bg-slate-100/80 dark:hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <KindIcon item={item} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-medium">{item.name}</h2>
                    <p className={`mt-0.5 truncate text-xs ${item.status === 'failed' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400'}`}>{statusLine(item)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {item.status === 'downloading' && <button type="button" title={zh ? '取消' : 'Cancel'} onClick={() => cancelDownload(item.id)} className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"><X size={15} /></button>}
                    {(item.status === 'failed' || item.status === 'canceled') && item.sourceUrl && <button type="button" title={zh ? '重试' : 'Retry'} onClick={() => retry(item)} className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"><RotateCw size={15} /></button>}
                    {canPreview && <button type="button" title={kindOf(item) === 'music' ? (zh ? '试听' : 'Play') : (zh ? '预览' : 'Preview')} onClick={() => void togglePreview(item)} className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10">{preview?.id === item.id ? <Pause size={15} /> : <Play size={15} />}</button>}
                    {done && <button type="button" title={zh ? '再次保存到电脑' : 'Save to computer again'} disabled={!item.blobId && !item.content} onClick={() => void saveAgain(item)} className="rounded-md p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10"><Download size={15} /></button>}
                    <button type="button" title={zh ? '删除记录' : 'Remove'} onClick={() => remove(item)} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><Trash2 size={15} /></button>
                  </div>
                </div>
                {item.status === 'downloading' && (
                  <div className="ml-[52px] mt-2 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div className={`h-full rounded-full bg-[#1a7cf5] transition-[width] duration-200 ${item.progress ? '' : 'w-1/3 animate-pulse'}`} style={item.progress ? { width: `${Math.round(item.progress * 100)}%` } : undefined} />
                  </div>
                )}
                {preview?.id === item.id && (
                  <div className="ml-[52px] mt-2">
                    {preview.kind === 'audio' ? <audio src={preview.url} controls autoPlay className="h-9 w-full max-w-md" /> : <img src={preview.url} alt={item.name} className="max-h-64 rounded-lg object-contain" />}
                  </div>
                )}
              </article>
            );
          })}
        </main>
      )}
    </div>
  );
};
