import { MediaTrack, useStore } from '../../store/useStore';

interface MediaController {
  play: (track: MediaTrack) => Promise<void>;
  pause?: (track: MediaTrack) => void;
  seek?: (track: MediaTrack, seconds: number) => void;
}

type ControllerKind = 'native' | 'spotify';

const mediaControllers = new Map<ControllerKind, MediaController>();

const controllerKindFor = (track: MediaTrack): ControllerKind | null => {
  if (track.playback === 'native') return 'native';
  if (track.playback === 'embed' && track.platform === 'spotify') return 'spotify';
  return null;
};

export const registerMediaController = (kind: ControllerKind, controller: MediaController) => {
  mediaControllers.set(kind, controller);
  return () => {
    if (mediaControllers.get(kind) === controller) mediaControllers.delete(kind);
  };
};

export const canControlMediaTrack = (track: MediaTrack | null) => Boolean(track && controllerKindFor(track));

export const playMediaFromGesture = (track: MediaTrack) => {
  const kind = controllerKindFor(track);
  const controller = kind ? mediaControllers.get(kind) : null;
  if (!controller) return Promise.reject(new Error('media-controller-unavailable'));
  return controller.play(track);
};

export const pauseMediaTrack = (track: MediaTrack) => {
  const kind = controllerKindFor(track);
  if (kind) mediaControllers.get(kind)?.pause?.(track);
};

export const seekMediaTrack = (track: MediaTrack, seconds: number) => {
  const kind = controllerKindFor(track);
  if (kind) mediaControllers.get(kind)?.seek?.(track, seconds);
};

/* ---------- Shared playback actions used by Control Center, Music and the lock screen ---------- */

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'audio-playback-failed');

export const getActiveTrack = () => {
  const { media } = useStore.getState();
  return media.tracks.find((track) => track.id === media.currentTrackId) ?? null;
};

export const pickAdjacentTrack = (direction: -1 | 1, fromId?: string | null) => {
  const { media } = useStore.getState();
  const tracks = media.tracks;
  if (!tracks.length) return null;
  const currentIndex = tracks.findIndex((track) => track.id === (fromId ?? media.currentTrackId));
  if (media.playMode === 'shuffle' && tracks.length > 1) {
    let index = currentIndex;
    while (index === currentIndex) index = Math.floor(Math.random() * tracks.length);
    return tracks[index];
  }
  if (currentIndex < 0) return tracks[0];
  return tracks[(currentIndex + direction + tracks.length) % tracks.length];
};

/** Select a track and start it when the site can control it. Embedded players start inside their own iframe. */
export const playTrack = (track: MediaTrack) => {
  const store = useStore.getState();
  store.selectMediaTrack(track.id);
  store.setMediaError(null);
  if (!canControlMediaTrack(track)) {
    store.setMediaPlaying(false);
    return Promise.resolve();
  }
  return playMediaFromGesture(track)
    .then(() => useStore.getState().setMediaPlaying(true))
    .catch((error) => {
      const latest = useStore.getState();
      latest.setMediaPlaying(false);
      const remote = track.playback === 'native' && Boolean(track.sourceUrl) && track.platform !== 'direct';
      const unsupported = error instanceof DOMException && (error.name === 'NotSupportedError' || error.name === 'AbortError');
      // AbortError happens when the user quickly picks another song; that is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      latest.setMediaError(remote && unsupported ? 'track-unavailable-single' : errorMessage(error));
    });
};

export const togglePlayback = () => {
  const track = getActiveTrack() ?? useStore.getState().media.tracks[0] ?? null;
  if (!track) return;
  const { media } = useStore.getState();
  if (media.isPlaying && track.id === media.currentTrackId) {
    pauseMediaTrack(track);
    useStore.getState().setMediaPlaying(false);
    return;
  }
  void playTrack(track);
};

export const skipTrack = (direction: -1 | 1) => {
  const { media } = useStore.getState();
  // Like Apple Music: "previous" restarts the song if it has been playing for a while.
  if (direction === -1 && media.position > 4) {
    const track = getActiveTrack();
    if (track) {
      useStore.getState().setMediaPosition(0);
      seekMediaTrack(track, 0);
      return;
    }
  }
  const next = pickAdjacentTrack(direction);
  if (next) void playTrack(next);
};
