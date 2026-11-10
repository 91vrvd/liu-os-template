import React, { useCallback, useEffect, useRef } from 'react';
import { getMediaBlob } from '../../lib/mediaStore';
import { MediaTrack, useStore } from '../../store/useStore';
import { pickAdjacentTrack, registerMediaController, skipTrack, togglePlayback } from './mediaController';

/**
 * The single <audio> element that plays every "native" track (direct links, Meting tracks, local files).
 * Selection changes load the new source; autoplay only happens after a user gesture or when the
 * previous song finished on its own, so browsers do not block it.
 */
export const MediaEngine: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<{ trackId: string; url: string } | null>(null);
  const autoplayRef = useRef<string | null>(null);
  const failedRunRef = useRef(0);
  const media = useStore((state) => state.media);
  const volume = useStore((state) => state.system.volume);
  const currentTrack = media.tracks.find((track) => track.id === media.currentTrackId) ?? null;
  const setMediaPlaying = useStore((state) => state.setMediaPlaying);
  const setMediaPosition = useStore((state) => state.setMediaPosition);
  const setMediaDuration = useStore((state) => state.setMediaDuration);
  const setMediaError = useStore((state) => state.setMediaError);
  const selectMediaTrack = useStore((state) => state.selectMediaTrack);
  const volumeRef = useRef(volume);

  useEffect(() => {
    volumeRef.current = volume;
    const audio = audioRef.current;
    if (audio) audio.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume]);

  const resolveSource = useCallback(async (track: MediaTrack) => {
    if (track.sourceUrl) return track.sourceUrl;
    if (!track.blobId) return '';
    if (objectUrlRef.current?.trackId === track.id) return objectUrlRef.current.url;
    const blob = await getMediaBlob(track.blobId);
    if (!blob) throw new Error('local-audio-missing');
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current.url);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = { trackId: track.id, url };
    return url;
  }, []);

  const attach = useCallback(async (track: MediaTrack) => {
    const audio = audioRef.current;
    if (!audio) throw new Error('media-controller-unavailable');
    if (audio.dataset.trackId === track.id && audio.getAttribute('src')) return audio;
    const source = await resolveSource(track);
    if (!source) throw new Error('audio-source-missing');
    audio.pause();
    audio.src = source;
    audio.dataset.trackId = track.id;
    audio.load();
    return audio;
  }, [resolveSource]);

  useEffect(() => registerMediaController('native', {
    play: async (track) => {
      setMediaError(null);
      autoplayRef.current = track.id;
      const audio = await attach(track);
      audio.volume = Math.max(0, Math.min(1, volumeRef.current / 100));
      await audio.play();
    },
    pause: () => audioRef.current?.pause(),
    seek: (_track, seconds) => {
      const audio = audioRef.current;
      if (audio && Number.isFinite(seconds)) audio.currentTime = Math.max(0, seconds);
    },
  }), [attach, setMediaError]);

  // React to selection changes made anywhere in the UI.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    let active = true;
    if (!currentTrack || currentTrack.playback !== 'native') {
      audio.pause();
      audio.removeAttribute('src');
      delete audio.dataset.trackId;
      audio.load();
      setMediaPosition(0);
      setMediaDuration(currentTrack?.duration ?? 0);
      return undefined;
    }
    if (audio.dataset.trackId === currentTrack.id) return undefined;
    setMediaPosition(0);
    setMediaDuration(currentTrack.duration ?? 0);
    const shouldAutoplay = autoplayRef.current === currentTrack.id;
    void attach(currentTrack).then((element) => {
      if (!active || !shouldAutoplay) return undefined;
      element.volume = Math.max(0, Math.min(1, volumeRef.current / 100));
      return element.play();
    }).catch((error) => {
      if (!active) return;
      setMediaPlaying(false);
      setMediaError(error instanceof Error ? error.message : 'audio-source-missing');
    });
    return () => {
      active = false;
    };
  }, [attach, currentTrack, setMediaDuration, setMediaError, setMediaPlaying, setMediaPosition]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || currentTrack?.playback !== 'native') return;
    if (!media.isPlaying && !audio.paused) audio.pause();
  }, [currentTrack?.playback, media.isPlaying]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current.url);
  }, []);

  const advance = useCallback(() => {
    const { media: latest } = useStore.getState();
    const track = latest.tracks.find((item) => item.id === latest.currentTrackId);
    if (!track) return;
    if (latest.playMode === 'repeat-one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch(() => setMediaPlaying(false));
      }
      return;
    }
    // Continue with the next song the site can play itself; embedded players need their own click.
    let next = pickAdjacentTrack(1, track.id);
    for (let guard = 0; next && next.playback !== 'native' && guard < latest.tracks.length; guard += 1) {
      next = pickAdjacentTrack(1, next.id);
    }
    if (!next || next.playback !== 'native' || next.id === track.id) {
      setMediaPlaying(false);
      setMediaPosition(0);
      return;
    }
    autoplayRef.current = next.id;
    selectMediaTrack(next.id);
  }, [selectMediaTrack, setMediaPlaying, setMediaPosition]);

  // Lock screen / headphone / keyboard media keys.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (currentTrack) {
      try {
        session.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: 'Liu OS',
          artwork: currentTrack.cover ? [{ src: currentTrack.cover, sizes: '300x300' }] : [],
        });
      } catch {
        // Some browsers ship mediaSession without MediaMetadata.
      }
    } else {
      session.metadata = null;
    }
    session.playbackState = media.isPlaying ? 'playing' : 'paused';
  }, [currentTrack, media.isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => togglePlayback()],
      ['pause', () => togglePlayback()],
      ['previoustrack', () => skipTrack(-1)],
      ['nexttrack', () => skipTrack(1)],
      ['seekto', (details) => {
        const audio = audioRef.current;
        if (audio && typeof details.seekTime === 'number') audio.currentTime = details.seekTime;
      }],
    ];
    handlers.forEach(([action, handler]) => {
      try { session.setActionHandler(action, handler); } catch { /* unsupported action */ }
    });
    return () => handlers.forEach(([action]) => {
      try { session.setActionHandler(action, null); } catch { /* unsupported action */ }
    });
  }, []);

  return <audio
    ref={audioRef}
    aria-hidden="true"
    className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
    preload="metadata"
    playsInline
    onLoadedMetadata={(event) => {
      const duration = event.currentTarget.duration;
      setMediaDuration(Number.isFinite(duration) && duration > 0 ? duration : currentTrack?.duration || 0);
    }}
    onPlay={() => {
      failedRunRef.current = 0;
      setMediaPlaying(true);
      setMediaError(null);
    }}
    onPause={() => setMediaPlaying(false)}
    onTimeUpdate={(event) => setMediaPosition(event.currentTarget.currentTime)}
    onEnded={advance}
    onError={(event) => {
      if (!event.currentTarget.getAttribute('src')) return;
      setMediaPlaying(false);
      const isRemote = Boolean(currentTrack?.sourceUrl) && currentTrack?.platform !== 'direct';
      // A song in an auto-played sequence that cannot be played (VIP / region locked) is skipped.
      const { media: latest } = useStore.getState();
      const willSkip = autoplayRef.current === currentTrack?.id && failedRunRef.current < Math.min(6, latest.tracks.length - 1);
      setMediaError(isRemote ? (willSkip ? 'track-unavailable' : 'track-unavailable-single') : 'audio-playback-failed');
      if (willSkip) {
        failedRunRef.current += 1;
        window.setTimeout(advance, 900);
      }
    }}
  />;
};
