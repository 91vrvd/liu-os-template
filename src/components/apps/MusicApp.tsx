import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, Download, ExternalLink, Heart, Library, Link2, ListMusic, Loader2, Maximize2, Music2, Pause, Play, Plus, Repeat, Repeat1, Search,
  Server, Shuffle, SkipBack, SkipForward, Trash2, Upload, Volume2, X,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { MediaTrack, useStore } from '../../store/useStore';
import {
  BUILT_IN_MUSIC_SOURCES, METING_SERVERS, MetingServer, MusicSource, makeTrackId,
  metingRequest, normalizeSourceUrl, parseMusicLink, platformLabel, testMusicSource,
} from '../../lib/musicSources';
import { deleteMediaBlob, hasMediaStorageCapacity, makeMediaBlobId, saveMediaBlob } from '../../lib/mediaStore';
import { canControlMediaTrack, playTrack, seekMediaTrack, skipTrack, togglePlayback } from '../os/mediaController';
import { mediaErrorText } from '../os/mediaErrors';
import { SpotifyEmbedPlayer } from '../os/SpotifyEmbedPlayer';
import { Scrubber } from '../os/Scrubber';
import { DownloadSheet } from './music/DownloadSheet';
import { useLyrics } from './music/useLyrics';

type Tab = 'search' | 'library' | 'add' | 'sources';

const Cover: React.FC<{ track: MediaTrack | null; className?: string; iconSize?: number }> = ({ track, className = '', iconSize = 18 }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [track?.cover]);
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#fb5c74] to-[#fa233b] text-white ${className}`}>
      {track?.cover && !failed
        ? <img src={track.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : <Music2 size={iconSize} />}
    </span>
  );
};

const useAllSources = () => {
  const custom = useStore((state) => state.musicSources.custom);
  const activeId = useStore((state) => state.musicSources.activeId);
  const sources: MusicSource[] = useMemo(() => [...BUILT_IN_MUSIC_SOURCES, ...custom], [custom]);
  const active: MusicSource | null = sources.find((source) => source.id === activeId) ?? sources[0] ?? null;
  return { sources, active };
};

export const MusicApp: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const media = useStore((state) => state.media);
  const addMediaTrack = useStore((state) => state.addMediaTrack);
  const removeMediaTrack = useStore((state) => state.removeMediaTrack);
  const clearLocalMediaTracks = useStore((state) => state.clearLocalMediaTracks);
  const setMediaPlayMode = useStore((state) => state.setMediaPlayMode);
  const setMediaPosition = useStore((state) => state.setMediaPosition);
  const setMediaError = useStore((state) => state.setMediaError);
  const volume = useStore((state) => state.system.volume);
  const setSystemValue = useStore((state) => state.setSystemValue);
  const { sources, active: activeSource } = useAllSources();
  const activeTrack = media.tracks.find((track) => track.id === media.currentTrackId) ?? null;
  const [tab, setTab] = useState<Tab>(media.tracks.length ? 'library' : 'search');
  const [downloadTrack, setDownloadTrack] = useState<MediaTrack | null>(null);
  const setMusicFullscreen = useStore((state) => state.setMusicFullscreen);
  const openApp = useStore((state) => state.openApp);
  const canDownload = (track: MediaTrack | null) => Boolean(track && (track.blobId || (track.sourceUrl && track.playback === 'native')));

  const addAndPlay = (tracks: MediaTrack[], play = true) => {
    if (!tracks.length) return;
    [...tracks].reverse().forEach(addMediaTrack);
    const stored = useStore.getState().media.tracks.find((item) => item.id === tracks[0].id
      || (tracks[0].sourceUrl && item.sourceUrl === tracks[0].sourceUrl)
      || (tracks[0].embedUrl && item.embedUrl === tracks[0].embedUrl));
    if (stored && play) void playTrack(stored);
  };

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'search', icon: <Search size={15} />, label: zh ? '搜索' : 'Search' },
    { id: 'library', icon: <ListMusic size={15} />, label: zh ? `播放列表${media.tracks.length ? ` · ${media.tracks.length}` : ''}` : `Playlist${media.tracks.length ? ` · ${media.tracks.length}` : ''}` },
    { id: 'add', icon: <Link2 size={15} />, label: zh ? '链接与本地' : 'Links & Files' },
    { id: 'sources', icon: <Server size={15} />, label: zh ? '音源' : 'Sources' },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white text-[#1d1d1f] dark:bg-[#1c1c1e] dark:text-white">
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 flex-col gap-1 border-r border-black/5 bg-[#f5f5f7]/80 p-3 dark:border-white/10 dark:bg-[#232325] md:flex">
          <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-[13px] font-semibold"><Library size={15} className="text-[#fa233b]" />{zh ? '音乐' : 'Music'}</div>
          {tabs.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${tab === item.id ? 'bg-black/[0.07] font-medium dark:bg-white/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/5'}`}>
              <span className={tab === item.id ? 'text-[#fa233b]' : 'opacity-60'}>{item.icon}</span>{item.label}
            </button>
          ))}
          <div className="mt-auto rounded-lg bg-black/[0.04] p-2.5 text-[11px] leading-relaxed opacity-70 dark:bg-white/5">
            {activeSource
              ? <>{zh ? '当前音源：' : 'Source: '}<b>{activeSource.name}</b></>
              : <button type="button" onClick={() => setTab('sources')} className="text-left underline underline-offset-2">{zh ? '还没有音源，点这里添加' : 'No source yet — add one'}</button>}
            <div className="mt-1.5 flex items-center gap-1"><Heart size={11} className="text-[#fa233b]" />{zh ? '支持正版音乐' : 'Support licensed music'}</div>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="scrollbar-hide flex gap-1 overflow-x-auto border-b border-black/5 px-3 py-2 dark:border-white/10 md:hidden">
            {tabs.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] ${tab === item.id ? 'bg-[#fa233b] text-white' : 'bg-black/5 dark:bg-white/10'}`}>{item.icon}{item.label}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {tab === 'search' && <SearchPanel source={activeSource} zh={zh} onPlay={(track) => addAndPlay([track])} onAdd={(tracks) => addAndPlay(tracks, false)} onAddSource={() => setTab('sources')} />}
            {tab === 'library' && (
              <LibraryPanel
                zh={zh}
                tracks={media.tracks}
                activeId={media.currentTrackId}
                isPlaying={media.isPlaying}
                onRemove={(track) => { removeMediaTrack(track.id); if (track.blobId) void deleteMediaBlob(track.blobId); }}
                onClear={() => { media.tracks.filter((track) => track.blobId && !track.id.startsWith('managed-')).forEach((track) => void deleteMediaBlob(track.blobId!)); clearLocalMediaTracks(); }}
                onGoSearch={() => setTab('search')}
                onDownload={(track) => setDownloadTrack(track)}
                canDownload={canDownload}
              />
            )}
            {tab === 'add' && <AddPanel zh={zh} source={activeSource} onAdd={(tracks, play) => { addAndPlay(tracks, play); setTab('library'); }} onError={setMediaError} />}
            {tab === 'sources' && <SourcesPanel zh={zh} sources={sources} activeId={activeSource?.id ?? ''} />}
          </div>
          {activeTrack && activeTrack.playback === 'embed' && (
            <div className="border-t border-black/5 px-4 py-3 dark:border-white/10">
              <div className="mb-1 text-[11px] opacity-60">{zh ? `${platformLabel(activeTrack.platform, language)} 官方播放器：请在播放器里点播放` : `${platformLabel(activeTrack.platform, language)} official player — press play inside it`}</div>
              {activeTrack.platform === 'spotify'
                ? <SpotifyEmbedPlayer key={activeTrack.id} track={activeTrack} />
                : <iframe key={activeTrack.id} src={activeTrack.embedUrl} title={activeTrack.title} allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" className={`w-full rounded-xl border-0 bg-black/5 ${activeTrack.platform === 'apple' ? 'h-[175px]' : 'h-[86px]'}`} />}
            </div>
          )}
        </main>

        <NowPlayingSide zh={zh} track={activeTrack} position={media.position} onExpand={() => setMusicFullscreen(true)} />
      </div>

      {/* Player bar */}
      <div className="border-t border-black/5 bg-[#fbfbfd]/90 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-[#232325]/90 sm:px-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => activeTrack && setMusicFullscreen(true)} aria-label={zh ? '全屏播放' : 'Full-screen player'} className="group relative shrink-0">
            <Cover track={activeTrack} className="h-11 w-11 rounded-lg shadow" />
            {activeTrack && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-white opacity-0 transition group-hover:opacity-100"><Maximize2 size={15} /></span>}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{activeTrack?.title ?? (zh ? '未在播放' : 'Not Playing')}</div>
            <div className="truncate text-[11px] opacity-60">{activeTrack ? [activeTrack.artist, platformLabel(activeTrack.platform, language)].filter(Boolean).join(' · ') : (zh ? '搜索一首歌，或粘贴歌曲/歌单链接' : 'Search for a song or paste a link')}</div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button type="button" aria-label={zh ? '播放顺序' : 'Play mode'} title={media.playMode === 'order' ? (zh ? '列表循环' : 'Repeat all') : media.playMode === 'repeat-one' ? (zh ? '单曲循环' : 'Repeat one') : (zh ? '随机播放' : 'Shuffle')} onClick={() => setMediaPlayMode(media.playMode === 'order' ? 'repeat-one' : media.playMode === 'repeat-one' ? 'shuffle' : 'order')} className="hidden rounded-full p-2 text-[#fa233b] hover:bg-black/5 dark:hover:bg-white/10 sm:block">
              {media.playMode === 'order' ? <Repeat size={16} /> : media.playMode === 'repeat-one' ? <Repeat1 size={16} /> : <Shuffle size={16} />}
            </button>
            <button type="button" aria-label={zh ? '上一首' : 'Previous'} disabled={!media.tracks.length} onClick={() => skipTrack(-1)} className="rounded-full p-2 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"><SkipBack size={18} fill="currentColor" /></button>
            <button type="button" aria-label={zh ? '播放或暂停' : 'Play or pause'} disabled={!media.tracks.length || Boolean(activeTrack && !canControlMediaTrack(activeTrack))} onClick={togglePlayback} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fa233b] text-white shadow-md transition hover:scale-105 disabled:opacity-35">{media.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}</button>
            <button type="button" aria-label={zh ? '下一首' : 'Next'} disabled={!media.tracks.length} onClick={() => skipTrack(1)} className="rounded-full p-2 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"><SkipForward size={18} fill="currentColor" /></button>
          </div>
          {canDownload(activeTrack) && <button type="button" aria-label={zh ? '下载' : 'Download'} title={zh ? '下载' : 'Download'} onClick={() => setDownloadTrack(activeTrack)} className="hidden rounded-full p-2 opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10 sm:block"><Download size={16} /></button>}
          {activeTrack && <button type="button" aria-label={zh ? '全屏歌词' : 'Full-screen lyrics'} title={zh ? '全屏歌词' : 'Full-screen lyrics'} onClick={() => setMusicFullscreen(true)} className="rounded-full p-2 opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"><Maximize2 size={16} /></button>}
          <label className="hidden items-center gap-1.5 lg:flex">
            <Volume2 size={14} className="opacity-60" />
            <input aria-label={zh ? '音量' : 'Volume'} type="range" min={0} max={100} value={volume} onChange={(event) => setSystemValue('volume', Number(event.target.value))} className="w-24 accent-[#fa233b]" />
          </label>
        </div>
        {activeTrack && canControlMediaTrack(activeTrack) && (
          <Scrubber className="mt-1" tone="accent" position={media.position} duration={media.duration} label={zh ? '播放进度' : 'Seek'} onSeek={(value) => { setMediaPosition(value); seekMediaTrack(activeTrack, value); }} />
        )}
        {downloadTrack && <DownloadSheet track={downloadTrack} onClose={() => setDownloadTrack(null)} onOpenDownloads={() => { setDownloadTrack(null); openApp('downloads'); }} />}
        {media.error && <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-600 dark:text-red-300"><span>{mediaErrorText(media.error, language)}</span><button type="button" aria-label={zh ? '关闭提示' : 'Dismiss'} onClick={() => setMediaError(null)}><X size={13} /></button></div>}
      </div>
    </div>
  );
};

/* ---------------- Search ---------------- */

const SearchPanel: React.FC<{ source: MusicSource | null; zh: boolean; onPlay: (track: MediaTrack) => void; onAdd: (tracks: MediaTrack[]) => void; onAddSource: () => void }> = ({ source, zh, onPlay, onAdd, onAddSource }) => {
  const [query, setQuery] = useState('');
  const [server, setServer] = useState<MetingServer>('netease');
  const [results, setResults] = useState<MediaTrack[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const tracks = useStore((state) => state.media.tracks);
  const currentId = useStore((state) => state.media.currentTrackId);

  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;
    // A pasted link in the search box is treated like an import.
    if (/^https?:\/\//i.test(keyword) || /music\.163\.com|y\.qq\.com|kugou\.com|spotify\.com|music\.apple\.com/i.test(keyword)) {
      const parsed = parseMusicLink(keyword);
      if (parsed.kind === 'meting' && source) {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setStatus('loading');
        try {
          const found = await metingRequest(source, parsed.server, parsed.type, parsed.id, controller.signal);
          setResults(found);
          setStatus(found.length ? 'idle' : 'empty');
        } catch {
          if (!controller.signal.aborted) setStatus('error');
        }
        return;
      }
      if (parsed.kind === 'embed' || parsed.kind === 'direct') {
        onPlay(parsed.track);
        return;
      }
    }
    if (!source) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    try {
      const found = await metingRequest(source, server, 'search', keyword, controller.signal);
      setResults(found);
      setStatus(found.length ? 'idle' : 'empty');
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    }
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!source) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-[#fb5c74] to-[#fa233b] text-white shadow-lg"><Server size={24} /></div>
        <p className="text-[15px] font-semibold">{zh ? '先添加一个音源' : 'Add a music source first'}</p>
        <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed opacity-60">{zh ? '搜索歌曲需要一个 Meting API 音源。也可以直接到「链接与本地」粘贴音频链接或导入本地文件。' : 'Searching needs a Meting API source. You can also paste audio links or import local files under Links & Files.'}</p>
        <button type="button" onClick={onAddSource} className="mt-4 rounded-full bg-[#fa233b] px-4 py-1.5 text-[12px] font-semibold text-white">{zh ? '添加音源' : 'Add a source'}</button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5">
      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-45" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? '歌名、歌手，或直接粘贴歌曲/歌单链接' : 'Song, artist, or paste a song/playlist link'} className="w-full rounded-xl border border-black/10 bg-black/[0.03] py-2.5 pl-9 pr-3 text-[14px] outline-none focus:border-[#fa233b]/60 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10" />
        </div>
        <button type="submit" disabled={!query.trim() || status === 'loading'} className="flex items-center gap-1.5 rounded-xl bg-[#fa233b] px-4 text-[13px] font-semibold text-white disabled:opacity-40">{status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}<span className="hidden sm:inline">{zh ? '搜索' : 'Search'}</span></button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {METING_SERVERS.map((item) => (
          <button key={item.id} type="button" onClick={() => setServer(item.id)} className={`rounded-full px-3 py-1 text-[12px] transition ${server === item.id ? 'bg-[#1d1d1f] text-white dark:bg-white dark:text-black' : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15'}`}>{zh ? item.zh : item.en}</button>
        ))}
      </div>

      {status === 'error' && <p className="mt-6 rounded-xl bg-amber-500/10 p-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">{zh ? `音源「${source.name}」暂时连不上，可以稍后再试，或在「音源」里换一个。` : `"${source.name}" is not reachable right now. Try again later or switch sources.`}</p>}
      {status === 'empty' && <p className="mt-6 text-center text-[13px] opacity-60">{zh ? '没有找到结果，换个关键词或平台试试。' : 'No results. Try another keyword or platform.'}</p>}
      {status === 'idle' && !results.length && (
        <div className="mt-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fb5c74] to-[#fa233b] text-white shadow-lg"><Music2 size={26} /></div>
          <p className="text-[14px] font-medium">{zh ? '想听什么？' : 'What do you want to hear?'}</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed opacity-60">{zh ? '支持网易云、QQ 音乐、酷狗等平台的搜索；也可以把歌曲或歌单链接直接粘贴到上面，回车就能播放。' : 'Search NetEase, QQ Music, KuGou and more, or paste a song or playlist link above and press Enter.'}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] opacity-60">{zh ? `${results.length} 首` : `${results.length} songs`}</span>
            <button type="button" onClick={() => onAdd(results)} className="flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-[12px] font-medium hover:bg-black/10 dark:bg-white/10"><Plus size={13} />{zh ? '全部加入播放列表' : 'Add all'}</button>
          </div>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {results.map((track) => {
              const inList = tracks.some((item) => item.id === track.id || item.sourceUrl === track.sourceUrl);
              const playing = currentId === track.id;
              return (
                <li key={track.id} className="group flex items-center gap-3 py-2">
                  <button type="button" onClick={() => onPlay(track)} className="relative">
                    <Cover track={track} className="h-10 w-10 rounded-md" iconSize={15} />
                    <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-white opacity-0 transition group-hover:opacity-100"><Play size={14} fill="currentColor" /></span>
                  </button>
                  <button type="button" onClick={() => onPlay(track)} className="min-w-0 flex-1 text-left">
                    <div className={`truncate text-[13px] ${playing ? 'font-semibold text-[#fa233b]' : ''}`}>{track.title}</div>
                    <div className="truncate text-[11px] opacity-55">{track.artist}</div>
                  </button>
                  <button type="button" aria-label={zh ? '加入播放列表' : 'Add to playlist'} disabled={inList} onClick={() => onAdd([track])} className="rounded-full p-1.5 opacity-60 hover:bg-black/5 hover:opacity-100 disabled:opacity-30 dark:hover:bg-white/10">{inList ? <Check size={15} /> : <Plus size={15} />}</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ---------------- Playlist ---------------- */

const LibraryPanel: React.FC<{
  zh: boolean; tracks: MediaTrack[]; activeId: string | null; isPlaying: boolean;
  onRemove: (track: MediaTrack) => void; onClear: () => void; onGoSearch: () => void;
  onDownload: (track: MediaTrack) => void; canDownload: (track: MediaTrack) => boolean;
}> = ({ zh, tracks, activeId, isPlaying, onRemove, onClear, onGoSearch, onDownload, canDownload }) => {
  const { language } = useI18n();
  if (!tracks.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <ListMusic size={34} className="mb-3 opacity-30" />
        <p className="text-[14px] font-medium">{zh ? '播放列表是空的' : 'Your playlist is empty'}</p>
        <button type="button" onClick={onGoSearch} className="mt-3 rounded-full bg-[#fa233b] px-4 py-1.5 text-[12px] font-semibold text-white">{zh ? '去搜索歌曲' : 'Search songs'}</button>
      </div>
    );
  }
  return (
    <div className="p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[17px] font-bold">{zh ? '播放列表' : 'Playlist'}</h2>
        <button type="button" onClick={onClear} className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-500/10">{zh ? '清空' : 'Clear'}</button>
      </div>
      <ul>
        {tracks.map((track, index) => {
          const active = track.id === activeId;
          const managed = track.id.startsWith('managed-');
          return (
            <li key={track.id} className={`group flex items-center gap-3 rounded-lg px-2 py-1.5 ${active ? 'bg-[#fa233b]/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/5'}`}>
              <span className="w-5 text-center text-[11px] tabular-nums opacity-45">{active && isPlaying ? <span className="inline-flex h-3 items-end gap-[2px]">{[0, 1, 2].map((bar) => <span key={bar} className="liu-eq-bar w-[3px] rounded-sm bg-[#fa233b]" style={{ animationDelay: `${bar * 0.15}s` }} />)}</span> : index + 1}</span>
              <button type="button" onClick={() => void playTrack(track)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Cover track={track} className="h-9 w-9 rounded-md" iconSize={14} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13px] ${active ? 'font-semibold text-[#fa233b]' : ''}`}>{track.title}</span>
                  <span className="block truncate text-[11px] opacity-55">{[track.artist, platformLabel(track.platform, language)].filter(Boolean).join(' · ')}{managed ? (zh ? ' · 站长推荐' : ' · Featured') : ''}</span>
                </span>
              </button>
              {canDownload(track) && <button type="button" aria-label={zh ? '下载' : 'Download'} onClick={() => onDownload(track)} className="rounded p-1 opacity-40 hover:bg-black/10 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-60 dark:hover:bg-white/10"><Download size={13} /></button>}
              {track.externalUrl && <a href={track.externalUrl} target="_blank" rel="noopener noreferrer" aria-label={zh ? '打开来源' : 'Open source'} className="rounded p-1 opacity-0 transition hover:bg-black/10 group-hover:opacity-60 dark:hover:bg-white/10"><ExternalLink size={13} /></a>}
              {!managed && <button type="button" aria-label={zh ? '移除' : 'Remove'} onClick={() => onRemove(track)} className="rounded p-1 opacity-40 hover:bg-black/10 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-60 dark:hover:bg-white/10"><Trash2 size={13} /></button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/* ---------------- Links & local files ---------------- */

const AddPanel: React.FC<{ zh: boolean; source: MusicSource | null; onAdd: (tracks: MediaTrack[], play: boolean) => void; onError: (code: string | null) => void }> = ({ zh, source, onAdd, onError }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const importLinks = async () => {
    const lines = value.split(/\s+/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    const collected: MediaTrack[] = [];
    const messages: string[] = [];
    for (const line of lines.slice(0, 20)) {
      const parsed = parseMusicLink(line);
      if (parsed.kind === 'meting') {
        try {
          if (!source) throw new Error('no-source');
          const found = await metingRequest(source, parsed.server, parsed.type, parsed.id);
          if (found.length) collected.push(...found);
          else messages.push(zh ? `没有解析到歌曲：${line}` : `No songs found: ${line}`);
        } catch {
          // Fall back to NetEase's official embed when the Meting source is offline.
          if (parsed.server === 'netease') {
            const outchainType = parsed.type === 'playlist' ? 0 : parsed.type === 'album' ? 1 : 2;
            collected.push({ id: makeTrackId(), title: zh ? '网易云音乐' : 'NetEase Cloud Music', artist: parsed.type, externalUrl: parsed.url, embedUrl: `https://music.163.com/outchain/player?type=${outchainType}&id=${parsed.id}&auto=0&height=66`, platform: 'netease', playback: 'embed' });
            messages.push(source ? (zh ? '音源连不上，已改用网易云官方播放器。' : 'Source offline — using the NetEase official player instead.') : (zh ? '还没有音源，已改用网易云官方播放器。添加音源后可以在站内直接播放。' : 'No source yet — using the NetEase official player. Add a source to play in-site.'));
          } else {
            messages.push(source ? (zh ? `音源暂时连不上：${line}` : `Source unreachable: ${line}`) : (zh ? `需要先添加音源才能解析：${line}` : `Add a source to resolve: ${line}`));
          }
        }
      } else if (parsed.kind === 'embed' || parsed.kind === 'direct') {
        collected.push(parsed.track);
      } else if (parsed.kind === 'short') {
        messages.push(zh ? `短链接需要先在浏览器打开，再复制地址栏里的完整链接：${line}` : `Open this short link first and copy the full address: ${line}`);
      } else {
        messages.push(zh ? `无法识别：${line}` : `Not recognised: ${line}`);
      }
    }
    setBusy(false);
    setNotes(messages);
    if (collected.length) {
      onAdd(collected, true);
      setValue('');
    }
  };

  const importFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).slice(0, 30).filter((file) => file.size <= 50 * 1024 * 1024 && (file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i.test(file.name)));
    if (!files.length) { onError('audio-file-invalid'); return; }
    if (!(await hasMediaStorageCapacity(files.reduce((sum, file) => sum + file.size, 0)))) { onError('audio-storage-failed'); return; }
    const imported: MediaTrack[] = [];
    for (const file of files) {
      try {
        const blobId = makeMediaBlobId();
        await saveMediaBlob(blobId, file);
        imported.push({ id: makeTrackId(), title: file.name.replace(/\.[^.]+$/, ''), artist: zh ? '本地音频' : 'Local file', blobId, fileName: file.name, platform: 'direct', playback: 'native' });
      } catch {
        onError('audio-storage-failed');
      }
    }
    if (imported.length) { onError(null); onAdd(imported, true); }
  };

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <section>
        <h2 className="text-[15px] font-semibold">{zh ? '粘贴链接' : 'Paste links'}</h2>
        <p className="mt-1 text-[12px] leading-relaxed opacity-60">{zh ? '支持网易云、QQ 音乐、酷狗、酷我的歌曲 / 歌单 / 专辑链接，Spotify 与 Apple Music 链接，以及 mp3、m4a 等直接音频地址。一行一个。' : 'NetEase, QQ Music, KuGou and Kuwo song/playlist/album links, Spotify and Apple Music links, or direct mp3/m4a URLs. One per line.'}</p>
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} placeholder={'https://music.163.com/playlist?id=...\nhttps://y.qq.com/n/ryqq/songDetail/...\nhttps://example.com/song.mp3'} className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 font-mono text-[12px] outline-none focus:border-[#fa233b]/60 dark:border-white/10 dark:bg-white/5" />
        <button type="button" disabled={!value.trim() || busy} onClick={() => void importLinks()} className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#fa233b] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}{zh ? '解析并播放' : 'Import & play'}</button>
        {notes.length > 0 && <ul className="mt-2 space-y-1 text-[11px] text-amber-700 dark:text-amber-300">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      </section>
      <section className="border-t border-black/5 pt-5 dark:border-white/10">
        <h2 className="text-[15px] font-semibold">{zh ? '本地音频' : 'Local audio'}</h2>
        <p className="mt-1 text-[12px] leading-relaxed opacity-60">{zh ? '文件只保存在你这台设备的浏览器里，不会上传。' : 'Files stay in this browser on this device and are never uploaded.'}</p>
        <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 flex items-center gap-1.5 rounded-xl border border-black/10 px-4 py-2 text-[13px] font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"><Upload size={14} />{zh ? '选择音频文件' : 'Choose audio files'}</button>
        <input ref={fileRef} type="file" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm" className="hidden" onChange={(event) => { void importFiles(event.target.files); event.target.value = ''; }} />
      </section>
    </div>
  );
};

/* ---------------- Sources ---------------- */

const SourcesPanel: React.FC<{ zh: boolean; sources: MusicSource[]; activeId: string }> = ({ zh, sources, activeId }) => {
  const addMusicSource = useStore((state) => state.addMusicSource);
  const removeMusicSource = useStore((state) => state.removeMusicSource);
  const setActiveMusicSource = useStore((state) => state.setActiveMusicSource);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [state, setState] = useState<Record<string, 'testing' | 'ok' | 'fail'>>({});
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(sources.length === 0);

  const test = async (source: MusicSource) => {
    setState((current) => ({ ...current, [source.id]: 'testing' }));
    const ok = await testMusicSource(source);
    setState((current) => ({ ...current, [source.id]: ok ? 'ok' : 'fail' }));
    return ok;
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const baseUrl = normalizeSourceUrl(url);
    if (!baseUrl) { setFormError(zh ? '请填写 http(s) 开头的地址' : 'Enter an http(s) address'); return; }
    if (window.location.protocol === 'https:' && baseUrl.startsWith('http:') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(baseUrl)) {
      setFormError(zh ? '本站使用 https，浏览器会拦截 http 地址，请换成 https' : 'This site uses https, so browsers block plain http sources');
      return;
    }
    if (sources.some((source) => source.baseUrl === baseUrl)) { setFormError(zh ? '这个音源已经添加过了' : 'This source is already added'); return; }
    const source = { id: `custom-${Date.now().toString(36)}`, name: name.trim() || new URL(baseUrl).hostname, baseUrl };
    setFormError('');
    addMusicSource(source);
    setName('');
    setUrl('');
    setAdding(false);
    void test(source);
  };

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{zh ? '音源' : 'Sources'}</h2>
          {!adding && <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-[12px] font-medium hover:bg-black/10 dark:bg-white/10"><Plus size={13} />{zh ? '添加' : 'Add'}</button>}
        </div>
        {sources.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-black/15 p-4 text-center text-[12px] opacity-60 dark:border-white/15">{zh ? '还没有添加音源。' : 'No sources yet.'}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sources.map((source) => (
              <li key={source.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${source.id === activeId ? 'border-[#fa233b]/50 bg-[#fa233b]/5' : 'border-black/10 dark:border-white/10'}`}>
                <button type="button" onClick={() => setActiveMusicSource(source.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${source.id === activeId ? 'border-[#fa233b] bg-[#fa233b] text-white' : 'border-black/25 dark:border-white/30'}`}>{source.id === activeId && <Check size={10} strokeWidth={3} />}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{source.name}</span>
                    <span className="block truncate font-mono text-[11px] opacity-50">{source.baseUrl}</span>
                  </span>
                </button>
                <button type="button" onClick={() => void test(source)} className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-[11px] hover:bg-black/10 dark:bg-white/10">
                  {state[source.id] === 'testing' ? <Loader2 size={12} className="animate-spin" /> : state[source.id] === 'ok' ? (zh ? '✓ 可用' : '✓ OK') : state[source.id] === 'fail' ? (zh ? '✕ 不可用' : '✕ Failed') : (zh ? '测试' : 'Test')}
                </button>
                <button type="button" aria-label={zh ? '删除音源' : 'Remove source'} onClick={() => removeMusicSource(source.id)} className="shrink-0 rounded p-1 opacity-50 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {adding && (
        <form onSubmit={(event) => void add(event)} className="rounded-xl bg-black/[0.03] p-3 dark:bg-white/5">
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={zh ? '名称（可选）' : 'Name (optional)'} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#fa233b]/60 dark:border-white/10 dark:bg-black/20" />
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={zh ? 'Meting API 地址，例如 https://example.com/api' : 'Meting API address, e.g. https://example.com/api'} inputMode="url" autoFocus className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-[12px] outline-none focus:border-[#fa233b]/60 dark:border-white/10 dark:bg-black/20" />
          </div>
          {formError && <p className="mt-1.5 text-[11px] text-red-500">{formError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            {sources.length > 0 && <button type="button" onClick={() => { setAdding(false); setFormError(''); }} className="rounded-lg px-3 py-1.5 text-[12px] opacity-70 hover:bg-black/5 dark:hover:bg-white/10">{zh ? '取消' : 'Cancel'}</button>}
            <button type="submit" disabled={!url.trim()} className="flex items-center gap-1 rounded-lg bg-[#1d1d1f] px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"><Plus size={13} />{zh ? '添加并测试' : 'Add & test'}</button>
          </div>
        </form>
      )}
      <p className="flex items-start gap-2 rounded-xl bg-[#fa233b]/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-[#b4122a] dark:text-[#ff8a9b]">
        <Heart size={14} className="mt-0.5 shrink-0" fill="currentColor" />
        {zh ? '支持正版音乐。会员或有版权限制的歌曲本站不会绕过，喜欢的歌请在官方平台收听和购买。' : 'Support licensed music. Members-only or rights-restricted songs are never bypassed; please listen and buy on official platforms.'}
      </p>
    </div>
  );
};

/* ---------------- Now playing + lyrics (wide screens) ---------------- */

const NowPlayingSide: React.FC<{ zh: boolean; track: MediaTrack | null; position: number; onExpand: () => void }> = ({ zh, track, position, onExpand }) => {
  const { lines, loaded, current } = useLyrics(track, position);
  const listRef = useRef<HTMLDivElement>(null);
  const setMediaPosition = useStore((state) => state.setMediaPosition);
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-line="${current}"]`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [current]);

  if (!track) return null;
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-black/5 bg-[#f5f5f7]/60 p-4 dark:border-white/10 dark:bg-[#232325]/60 lg:flex">
      <button type="button" onClick={onExpand} className="group relative" aria-label={zh ? '全屏播放' : 'Full-screen player'}>
        <Cover track={track} className="aspect-square w-full rounded-2xl shadow-xl" iconSize={48} />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100"><Maximize2 size={12} />{zh ? '全屏歌词' : 'Full screen'}</span>
      </button>
      <div className="mt-3 truncate text-[15px] font-semibold">{track.title}</div>
      <div className="truncate text-[12px] opacity-60">{track.artist}</div>
      <div ref={listRef} className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[13px] leading-snug [mask-image:linear-gradient(transparent,black_12%,black_88%,transparent)]">
        {lines.length ? lines.map((line, index) => (
          <button
            key={`${line.time}-${index}`}
            type="button"
            data-line={index}
            onClick={() => { setMediaPosition(line.time); seekMediaTrack(track, line.time); }}
            className={`block w-full rounded-md px-1 py-1 text-left transition-all duration-300 hover:bg-black/5 dark:hover:bg-white/5 ${index === current ? 'font-semibold text-[#fa233b]' : 'opacity-45'}`}
          >
            {line.text}
          </button>
        )) : <p className="pt-6 text-center text-[12px] opacity-45">{!loaded ? (zh ? '正在加载歌词…' : 'Loading lyrics…') : (zh ? '这首歌没有歌词' : 'No lyrics for this song')}</p>}
      </div>
    </aside>
  );
};

export default MusicApp;
