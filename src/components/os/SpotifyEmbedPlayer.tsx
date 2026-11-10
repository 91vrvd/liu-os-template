import React, { useEffect, useRef, useState } from 'react';
import { MediaTrack, useStore } from '../../store/useStore';
import { registerMediaController } from './mediaController';

interface SpotifyPlaybackUpdate {
  data: {
    duration: number;
    position: number;
    isPaused: boolean;
    isBuffering: boolean;
  };
}

interface SpotifyEmbedController {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  loadEntity: (url: string) => void;
  addListener: (event: 'ready' | 'playback_started' | 'playback_update', listener: (event: SpotifyPlaybackUpdate) => void) => void;
}

interface SpotifyIframeApi {
  createController: (
    element: HTMLElement,
    options: { url: string; width: string; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
    __liuOsSpotifyApi?: SpotifyIframeApi;
  }
}

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null;

const loadSpotifyApi = () => {
  if (window.__liuOsSpotifyApi) return Promise.resolve(window.__liuOsSpotifyApi);
  if (spotifyApiPromise) return spotifyApiPromise;

  spotifyApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const previousCallback = window.onSpotifyIframeApiReady;
    const timeout = window.setTimeout(() => {
      spotifyApiPromise = null;
      reject(new Error('spotify-player-unavailable'));
    }, 15000);

    window.onSpotifyIframeApiReady = (api) => {
      window.clearTimeout(timeout);
      window.__liuOsSpotifyApi = api;
      previousCallback?.(api);
      resolve(api);
    };

    if (!document.querySelector('script[data-liu-os-spotify-api]')) {
      const script = document.createElement('script');
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      script.dataset.liuOsSpotifyApi = 'true';
      script.onerror = () => {
        window.clearTimeout(timeout);
        spotifyApiPromise = null;
        reject(new Error('spotify-player-unavailable'));
      };
      document.body.appendChild(script);
    }
  });

  return spotifyApiPromise;
};

const spotifySourceUrl = (track: MediaTrack) => track.externalUrl
  ?? track.embedUrl?.replace('open.spotify.com/embed/', 'open.spotify.com/')
  ?? '';

export const SpotifyEmbedPlayer: React.FC<{ track: MediaTrack }> = ({ track }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const trackRef = useRef(track);
  const [ready, setReady] = useState(false);
  const setMediaPlaying = useStore((state) => state.setMediaPlaying);
  const setMediaPosition = useStore((state) => state.setMediaPosition);
  const setMediaDuration = useStore((state) => state.setMediaDuration);
  const setMediaError = useStore((state) => state.setMediaError);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    let active = true;
    let unregister: () => void = () => {};
    const sourceUrl = spotifySourceUrl(track);

    if (!hostRef.current || !sourceUrl) {
      setMediaError('spotify-player-unavailable');
      return undefined;
    }

    setReady(false);
    setMediaError(null);

    void loadSpotifyApi().then((api) => {
      if (!active || !hostRef.current) return;
      api.createController(hostRef.current, { url: sourceUrl, width: '100%', height: 152 }, (controller) => {
        if (!active) {
          controller.pause();
          return;
        }

        controllerRef.current = controller;
        unregister = registerMediaController('spotify', {
          play: async (requestedTrack) => {
            const requestedUrl = spotifySourceUrl(requestedTrack);
            if (!requestedUrl) throw new Error('spotify-player-unavailable');
            if (requestedTrack.id !== trackRef.current.id) controller.loadEntity(requestedUrl);
            controller.play();
          },
          pause: () => controller.pause(),
          seek: (_requestedTrack, seconds) => controller.seek(seconds),
        });

        controller.addListener('ready', () => {
          if (!active) return;
          setReady(true);
          setMediaError(null);
        });
        controller.addListener('playback_started', () => {
          if (active) setMediaPlaying(true);
        });
        controller.addListener('playback_update', (event) => {
          if (!active) return;
          setMediaDuration(Math.max(0, event.data.duration / 1000));
          setMediaPosition(Math.max(0, event.data.position / 1000));
          setMediaPlaying(!event.data.isPaused && !event.data.isBuffering);
        });
      });
    }).catch((error) => {
      if (active) setMediaError(error instanceof Error ? error.message : 'spotify-player-unavailable');
    });

    return () => {
      active = false;
      unregister();
      controllerRef.current?.pause();
      controllerRef.current = null;
      setMediaPlaying(false);
    };
  }, [setMediaDuration, setMediaError, setMediaPlaying, setMediaPosition, track]);

  return (
    <div className="relative mt-2 min-h-[152px] overflow-hidden rounded-xl bg-[#181818]">
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/60">Spotify</div>}
      <div ref={hostRef} className="relative z-10 min-h-[152px] w-full" />
    </div>
  );
};
