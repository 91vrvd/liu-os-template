import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, Expand, ListMusic, Minimize, Music2, Pause, Play, Quote, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2 } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { useStore } from '../../../store/useStore';
import { platformLabel } from '../../../lib/musicSources';
import { canControlMediaTrack, seekMediaTrack, skipTrack, togglePlayback } from '../../os/mediaController';
import { Scrubber } from '../../os/Scrubber';
import { useLyrics } from './useLyrics';
import { DownloadSheet } from './DownloadSheet';

/**
 * Immersive "Now Playing" view: blurred artwork backdrop, large cover, synced lyrics that can be
 * tapped to jump, and full transport controls. Esc or the chevron closes it.
 */
export const FullscreenPlayer: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const open = useStore((state) => state.musicFullscreen);
  const setOpen = useStore((state) => state.setMusicFullscreen);
  const media = useStore((state) => state.media);
  const volume = useStore((state) => state.system.volume);
  const setSystemValue = useStore((state) => state.setSystemValue);
  const setMediaPlayMode = useStore((state) => state.setMediaPlayMode);
  const setMediaPosition = useStore((state) => state.setMediaPosition);
  const openApp = useStore((state) => state.openApp);
  const track = media.tracks.find((item) => item.id === media.currentTrackId) ?? null;
  const { lines, loaded, current } = useLyrics(open ? track : null, media.position);
  const [view, setView] = useState<'lyrics' | 'cover'>('lyrics');
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const userScrollAt = useRef(0);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) setOpen(false);
      if (event.key === ' ' && (event.target as HTMLElement).tagName !== 'INPUT') { event.preventDefault(); togglePlayback(); }
      if (event.key === 'ArrowRight' && event.metaKey) skipTrack(1);
      if (event.key === 'ArrowLeft' && event.metaKey) skipTrack(-1);
    };
    const onFullscreen = () => setBrowserFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [open, setOpen]);

  // Keep the active line centred unless the visitor has just scrolled the lyrics themselves.
  useEffect(() => {
    if (!open || current < 0 || Date.now() - userScrollAt.current < 2500) return;
    const node = lyricsRef.current?.querySelector<HTMLElement>(`[data-line="${current}"]`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [current, open, view]);

  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setOpen(false);
  };

  const toggleBrowserFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const seek = (seconds: number) => {
    if (!track) return;
    setMediaPosition(seconds);
    seekMediaTrack(track, seconds);
  };

  const controllable = Boolean(track && canControlMediaTrack(track));
  const hasLyrics = lines.length > 0;

  const renderControls = (compact: boolean) => (
      <div className={compact ? '' : 'mt-7'}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className={`truncate font-bold ${compact ? 'text-lg' : 'text-2xl'}`}>{track?.title ?? (zh ? '未在播放' : 'Not Playing')}</div>
            <div className="truncate text-sm text-white/65">{track?.artist}</div>
          </div>
          <div className="flex shrink-0 gap-1">
            {track?.sourceUrl || track?.blobId ? <button type="button" onClick={() => setDownloadOpen(true)} aria-label={zh ? '下载' : 'Download'} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"><Download size={16} /></button> : null}
            <button type="button" onClick={() => { close(); openApp('music'); }} aria-label={zh ? '播放列表' : 'Playlist'} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"><ListMusic size={16} /></button>
          </div>
        </div>
        <Scrubber className="mt-4" tone="light" position={media.position} duration={controllable ? media.duration : 0} onSeek={seek} label={zh ? '播放进度' : 'Seek'} />
        <div className="mt-3 flex items-center justify-between">
          <button type="button" aria-label={zh ? '播放顺序' : 'Play mode'} onClick={() => setMediaPlayMode(media.playMode === 'order' ? 'repeat-one' : media.playMode === 'repeat-one' ? 'shuffle' : 'order')} className="rounded-full p-2 text-white/80 transition hover:bg-white/10">
            {media.playMode === 'order' ? <Repeat size={18} /> : media.playMode === 'repeat-one' ? <Repeat1 size={18} /> : <Shuffle size={18} />}
          </button>
          <div className="flex items-center gap-5">
            <button type="button" aria-label={zh ? '上一首' : 'Previous'} onClick={() => skipTrack(-1)} className="rounded-full p-2 transition hover:bg-white/10 active:scale-90"><SkipBack size={28} fill="currentColor" /></button>
            <button type="button" aria-label={zh ? '播放或暂停' : 'Play or pause'} disabled={!controllable} onClick={togglePlayback} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-xl transition hover:scale-105 active:scale-95 disabled:opacity-40">{media.isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="translate-x-0.5" />}</button>
            <button type="button" aria-label={zh ? '下一首' : 'Next'} onClick={() => skipTrack(1)} className="rounded-full p-2 transition hover:bg-white/10 active:scale-90"><SkipForward size={28} fill="currentColor" /></button>
          </div>
          <span className="w-9" />
        </div>
        {!compact && (
          <label className="mt-4 flex items-center gap-3 text-white/70">
            <Volume1 size={16} />
            <input type="range" min={0} max={100} value={volume} aria-label={zh ? '音量' : 'Volume'} onChange={(event) => setSystemValue('volume', Number(event.target.value))} className="h-1 flex-1 accent-white" />
            <Volume2 size={16} />
          </label>
        )}
      </div>
    );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="fullscreen-player"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="fixed inset-0 z-[120] overflow-hidden bg-[#140c10] text-white"
          role="dialog"
          aria-label={zh ? '正在播放' : 'Now Playing'}
        >
          {/* Backdrop: the artwork, heavily blurred, drifting slowly. */}
          <div className="absolute inset-0">
            {track?.cover
              ? <img src={track.cover} alt="" referrerPolicy="no-referrer" className="liu-player-backdrop absolute left-1/2 top-1/2 h-[160%] w-[160%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-80 blur-[90px] saturate-150" />
              : <div className="absolute inset-0 bg-gradient-to-br from-[#5b1a2c] via-[#2a1330] to-[#0d1b2a]" />}
            <div className="absolute inset-0 bg-black/45" />
          </div>

          <div className="relative flex h-full flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-10">
            <header className="flex shrink-0 items-center justify-between gap-3 py-2">
              <button type="button" onClick={close} aria-label={zh ? '收起' : 'Close'} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"><ChevronDown size={20} /></button>
              <div className="min-w-0 text-center text-[11px] uppercase tracking-[0.18em] text-white/60">{zh ? '正在播放' : 'Now Playing'}{track ? ` · ${platformLabel(track.platform, language)}` : ''}</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setView(view === 'lyrics' ? 'cover' : 'lyrics')} aria-label={zh ? '切换歌词' : 'Toggle lyrics'} className={`rounded-full p-2 transition lg:hidden ${view === 'lyrics' ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20'}`}><Quote size={18} /></button>
                <button type="button" onClick={toggleBrowserFullscreen} aria-label={browserFullscreen ? (zh ? '退出全屏' : 'Exit full screen') : (zh ? '全屏' : 'Full screen')} className="hidden rounded-full bg-white/10 p-2 transition hover:bg-white/20 sm:block">{browserFullscreen ? <Minimize size={18} /> : <Expand size={18} />}</button>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
              {/* Cover + info + controls */}
              <section className={`mx-auto w-full max-w-[460px] flex-col justify-center ${view === 'lyrics' ? 'hidden lg:flex' : 'flex'}`}>
                <motion.div
                  key={track?.id ?? 'none'}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: media.isPlaying ? 1 : 0.9, opacity: 1 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 180 }}
                  className="aspect-square w-full overflow-hidden rounded-2xl bg-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
                >
                  {track?.cover ? <img src={track.cover} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fb5c74] to-[#fa233b]"><Music2 size={96} /></div>}
                </motion.div>
                {renderControls(false)}
              </section>

              {/* Lyrics */}
              <section className={`relative h-full min-h-0 ${view === 'cover' ? 'hidden lg:block' : 'block'}`}>
                {hasLyrics ? (
                  <div
                    ref={lyricsRef}
                    onWheel={() => { userScrollAt.current = Date.now(); }}
                    onTouchMove={() => { userScrollAt.current = Date.now(); }}
                    className="scrollbar-hide h-full overflow-y-auto py-[35vh] [mask-image:linear-gradient(transparent,black_18%,black_82%,transparent)]"
                  >
                    {lines.map((line, index) => {
                      const distance = Math.abs(index - current);
                      return (
                        <button
                          key={`${line.time}-${index}`}
                          type="button"
                          data-line={index}
                          onClick={() => seek(line.time)}
                          disabled={!controllable}
                          className={`block w-full origin-left py-2 text-left text-[clamp(20px,2.6vw,34px)] font-bold leading-snug tracking-tight transition-all duration-500 ease-out ${index === current ? 'scale-100 text-white' : 'scale-[0.96] text-white/35 hover:text-white/60'}`}
                          style={{ filter: index === current ? 'none' : `blur(${Math.min(distance, 4) * 0.35}px)` }}
                        >
                          {line.text}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-white/60">
                    <Quote size={36} className="mb-3 opacity-50" />
                    <p className="text-lg font-semibold">{!track ? (zh ? '还没有在播放的歌曲' : 'Nothing is playing') : !loaded ? (zh ? '正在加载歌词…' : 'Loading lyrics…') : (zh ? '这首歌暂无歌词' : 'No lyrics for this song')}</p>
                    <div className="mt-8 w-full max-w-md lg:hidden">{renderControls(true)}</div>
                  </div>
                )}
              </section>
            </div>

            {/* Phone: compact controls under the lyrics */}
            {view === 'lyrics' && hasLyrics && <div className="shrink-0 pt-3 lg:hidden">{renderControls(true)}</div>}
          </div>
          {downloadOpen && track && <DownloadSheet track={track} onClose={() => setDownloadOpen(false)} onOpenDownloads={() => { setDownloadOpen(false); close(); openApp('downloads'); }} />}
        </motion.div>
      )}
    </AnimatePresence>
  );

};
