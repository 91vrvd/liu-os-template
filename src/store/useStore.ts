import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TranslationKey } from '../i18n';

export type AppId = 'about' | 'projects' | 'experience' | 'skills' | 'contact' | 'settings' | 'admin' | 'safari' | 'vscode' | 'terminal' | 'tv' | 'games' | 'downloads' | 'notes' | 'presentation' | 'toolbox' | 'lanShare' | 'transferCenter' | 'maps' | 'music';

export interface DownloadItem {
  id: string;
  name: string;
  type: string;
  extension?: string;
  size: number;
  createdAt: number;
  source: 'notes' | 'music' | 'image' | 'file' | 'share';
  content?: string;
  blobId?: string;
  documentId?: string;
  /** Live state for downloads made inside Liu OS. Older records have no status and count as done. */
  status?: 'downloading' | 'done' | 'failed' | 'canceled';
  progress?: number;
  received?: number;
  sourceUrl?: string;
  error?: string;
  detail?: string;
}

export type MediaPlatform = 'direct' | 'netease' | 'tencent' | 'kugou' | 'kuwo' | 'baidu' | 'spotify' | 'apple';
export type MediaPlayMode = 'order' | 'repeat-one' | 'shuffle';
export type WallpaperId = string;

export interface CustomMusicSource {
  id: string;
  name: string;
  baseUrl: string;
}

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  sourceUrl?: string;
  blobId?: string;
  fileName?: string;
  externalUrl?: string;
  embedUrl?: string;
  platform: MediaPlatform;
  duration?: number;
  playback: 'native' | 'embed' | 'external';
  cover?: string;
  lyricUrl?: string;
  sourceName?: string;
}

export interface WindowState {
  id: AppId;
  title: string;
  titleKey?: TranslationKey;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  origin?: DOMRect; // Source rect for animation
}

interface PortfolioStore {
  windows: Record<AppId, WindowState>;
  activeAppId: AppId | null;
  maxZIndex: number;

  openApp: (id: AppId, origin?: DOMRect) => void;
  closeApp: (id: AppId) => void;
  minimizeApp: (id: AppId) => void;
  toggleMaximizeApp: (id: AppId) => void;
  focusApp: (id: AppId) => void;
  updateWindowPosition: (id: AppId, position: { x: number; y: number }) => void;
  updateWindowSize: (id: AppId, size: { width: number; height: number }) => void;
  updateWindowBounds: (id: AppId, bounds: { position: { x: number; y: number }; size: { width: number; height: number } }) => void;
  downloads: DownloadItem[];
  addDownload: (download: DownloadItem) => void;
  updateDownload: (id: string, patch: Partial<DownloadItem>) => void;
  setDownloads: (downloads: DownloadItem[]) => void;
  removeDownload: (id: string) => void;
  media: {
    tracks: MediaTrack[];
    currentTrackId: string | null;
    isPlaying: boolean;
    position: number;
    duration: number;
    error: string | null;
    playMode: MediaPlayMode;
  };
  musicSources: {
    custom: CustomMusicSource[];
    activeId: string;
  };
  addMusicSource: (source: CustomMusicSource) => void;
  removeMusicSource: (id: string) => void;
  setActiveMusicSource: (id: string) => void;
  setMediaPlayMode: (mode: MediaPlayMode) => void;
  musicFullscreen: boolean;
  setMusicFullscreen: (open: boolean) => void;
  clearLocalMediaTracks: () => void;
  addMediaTrack: (track: MediaTrack) => void;
  setMediaTracks: (tracks: MediaTrack[]) => void;
  removeMediaTrack: (id: string) => void;
  selectMediaTrack: (id: string | null) => void;
  setMediaPlaying: (isPlaying: boolean) => void;
  setMediaPosition: (position: number) => void;
  setMediaDuration: (duration: number) => void;
  setMediaError: (error: string | null) => void;
  
  // System State
  system: {
    wifi: boolean;
    bluetooth: boolean;
    airdrop: boolean;
    darkMode: boolean;
    brightness: number;
    volume: number;
    controlCenterOpen: boolean;
    spotlightOpen: boolean;
    wallpaper: WallpaperId;
  };
  toggleSystem: (key: keyof PortfolioStore['system']) => void;
  setSystemValue: (key: 'brightness' | 'volume', value: number) => void;
  setControlCenterOpen: (isOpen: boolean) => void;
  setSpotlightOpen: (isOpen: boolean) => void;
  setWallpaper: (wallpaper: PortfolioStore['system']['wallpaper']) => void;
}

const defaultWindows: Record<AppId, WindowState> = {
  maps: {
    id: 'maps', title: 'Maps', titleKey: 'dock.maps', isOpen: false, isMinimized: false, isMaximized: false,
    position: { x: 70, y: 50 }, size: { width: 1160, height: 740 }, zIndex: 1,
  },
  about: {
    id: 'about',
    title: 'About Me',
    titleKey: 'window.about',
    isOpen: false, // Don't open About by default
    isMinimized: false,
    isMaximized: false,
    position: { x: 50, y: 50 },
    size: { width: 800, height: 600 },
    zIndex: 1,
  },
  projects: {
    id: 'projects',
    title: 'Projects',
    titleKey: 'window.projects',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 100, y: 100 },
    size: { width: 900, height: 700 }, // Wider for grid
    zIndex: 1,
  },
  experience: {
    id: 'experience',
    title: 'Experience',
    titleKey: 'window.experience',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 150, y: 150 },
    size: { width: 700, height: 600 },
    zIndex: 1,
  },
  skills: {
    id: 'skills',
    title: 'Skills',
    titleKey: 'window.skills',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 200, y: 200 },
    size: { width: 600, height: 500 },
    zIndex: 1,
  },
  contact: {
    id: 'contact',
    title: 'Contact',
    titleKey: 'window.contact',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 250, y: 250 },
    size: { width: 500, height: 500 },
    zIndex: 1,
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    titleKey: 'settings.appName',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 300, y: 300 },
    size: { width: 400, height: 400 },
    zIndex: 1,
  },
  admin: {
    id: 'admin',
    title: 'Content Admin',
    titleKey: 'window.admin',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 90, y: 55 },
    size: { width: 1080, height: 720 },
    zIndex: 1,
  },
  safari: {
    id: 'safari',
    title: 'Safari',
    titleKey: 'window.safari',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 80, y: 60 },
    size: { width: 1024, height: 700 }, 
    zIndex: 1,
  },
  vscode: {
    id: 'vscode',
    title: 'Visual Studio Code',
    titleKey: 'window.vscode',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 120, y: 80 },
    size: { width: 1100, height: 750 }, 
    zIndex: 1,
  },
  terminal: {
    id: 'terminal',
    title: 'Terminal',
    titleKey: 'window.terminal',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 150, y: 150 },
    size: { width: 600, height: 400 },
    zIndex: 1,
  },
  tv: {
    id: 'tv',
    title: 'TV',
    titleKey: 'window.tv',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 190, y: 90 },
    size: { width: 1040, height: 690 },
    zIndex: 1,
  },
  games: {
    id: 'games',
    title: 'Games',
    titleKey: 'window.games',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 100, y: 80 },
    size: { width: 900, height: 650 },
    zIndex: 1,
  },
  music: {
    id: 'music',
    title: 'Music',
    titleKey: 'window.music',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 140, y: 70 },
    size: { width: 980, height: 640 },
    zIndex: 1,
  },
  downloads: {
    id: 'downloads',
    title: 'Downloads',
    titleKey: 'window.downloads',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 220, y: 110 },
    size: { width: 640, height: 520 },
    zIndex: 1,
  },
  notes: {
    id: 'notes',
    title: 'Notes',
    titleKey: 'window.notes',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 120, y: 70 },
    size: { width: 900, height: 620 },
    zIndex: 1,
  },
  presentation: {
    id: 'presentation',
    title: 'Presentation',
    titleKey: 'window.presentation',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 180, y: 110 },
    size: { width: 620, height: 420 },
    zIndex: 1,
  },
  toolbox: {
    id: 'toolbox',
    title: 'Toolbox',
    titleKey: 'window.toolbox',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 220, y: 130 },
    size: { width: 560, height: 420 },
    zIndex: 1,
  },
  lanShare: {
    id: 'lanShare',
    title: 'LAN Transfer',
    titleKey: 'window.lanShare',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 170, y: 85 },
    size: { width: 980, height: 700 },
    zIndex: 1,
  },
  transferCenter: {
    id: 'transferCenter',
    title: 'Transfer Center',
    titleKey: 'window.transferCenter',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 240, y: 120 },
    size: { width: 760, height: 580 },
    zIndex: 1,
  },
};

export const useStore = create<PortfolioStore>()(
  persist(
    (set) => ({
  windows: defaultWindows,
  activeAppId: null,
  maxZIndex: 1,
  downloads: [],
  media: {
    tracks: [],
    currentTrackId: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    error: null,
    playMode: 'order',
  },
  musicFullscreen: false,
  musicSources: {
    custom: [],
    activeId: '',
  },
  
  system: {
      wifi: true,
      bluetooth: true,
      airdrop: true,
      darkMode: false,
      brightness: 100,
      volume: 75,
      controlCenterOpen: false,
      spotlightOpen: false,
      wallpaper: 'tahoe'
  },

  openApp: (id, origin) =>
    set((state) => {
      const newZIndex = state.maxZIndex + 1;
      // Keep newly opened windows inside the screen and above the Dock on smaller displays.
      const fitted = (() => {
        const current = state.windows[id];
        if (current.isOpen || typeof window === 'undefined' || window.innerWidth < 768) return {};
        const width = Math.min(current.size.width, window.innerWidth - 24);
        const height = Math.min(current.size.height, Math.max(320, window.innerHeight - 40 - 96));
        const x = Math.min(Math.max(12, current.position.x), Math.max(12, window.innerWidth - width - 12));
        const y = Math.min(Math.max(36, current.position.y), Math.max(36, window.innerHeight - 96 - height));
        return { size: { width, height }, position: { x, y } };
      })();
      
      return {
        activeAppId: id,
        maxZIndex: newZIndex,
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id],
            ...fitted,
            ...(id === 'maps' && !state.windows[id].isOpen ? {
              position: { x: Math.min(70, Math.max(20, (window.innerWidth - 1160) / 2)), y: 45 },
              size: { width: Math.min(1160, Math.max(320, window.innerWidth - 40)), height: Math.min(740, Math.max(360, window.innerHeight - 145)) },
            } : {}),
            ...(id === 'music' && !state.windows[id].isOpen ? {
              position: { x: Math.max(0, Math.round((window.innerWidth - Math.min(980, window.innerWidth - 24)) / 2)), y: 45 },
              size: { width: Math.min(980, Math.max(320, window.innerWidth - 24)), height: Math.min(640, Math.max(360, window.innerHeight - 130)) },
            } : {}),
            ...(id === 'tv' && !state.windows[id].isOpen ? {
              position: { x: Math.max(0, Math.round((window.innerWidth - Math.min(1040, window.innerWidth - 24)) / 2)), y: 45 },
              size: { width: Math.min(1040, Math.max(320, window.innerWidth - 24)), height: Math.min(690, Math.max(320, window.innerHeight - 130)) },
            } : {}),
            isOpen: true,
            isMinimized: false,
            zIndex: newZIndex,
             origin: origin || state.windows[id].origin, 
          },
        },
      };
    }),

  closeApp: (id) =>
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], isOpen: false },
      },
      activeAppId: state.activeAppId === id ? null : state.activeAppId,
    })),

  minimizeApp: (id) =>
    set((state) => ({
        activeAppId: state.activeAppId === id ? null : state.activeAppId, 
        windows: {
            ...state.windows,
            [id]: { ...state.windows[id], isMinimized: true },
        },
    })),

  toggleMaximizeApp: (id) =>
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], isMaximized: !state.windows[id].isMaximized },
      },
    })),

  focusApp: (id) =>
    set((state) => {
      if (state.activeAppId === id) return {}; 
      const newZIndex = state.maxZIndex + 1;
      return {
        activeAppId: id,
        maxZIndex: newZIndex,
        windows: {
          ...state.windows,
          [id]: { ...state.windows[id], zIndex: newZIndex, isMinimized: false },
        },
      };
    }),

  updateWindowPosition: (id, position) =>
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], position },
      },
    })),

  updateWindowSize: (id, size) =>
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], size },
      },
    })),

  updateWindowBounds: (id, bounds) =>
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], position: bounds.position, size: bounds.size },
      },
    })),

  addDownload: (download) => set((state) => ({
    downloads: [download, ...state.downloads.filter((item) => item.id !== download.id)].slice(0, 200),
  })),

  updateDownload: (id, patch) => set((state) => ({
    downloads: state.downloads.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  })),

  setDownloads: (downloads) => set({ downloads: downloads.slice(0, 80) }),

  removeDownload: (id) => set((state) => ({
    downloads: state.downloads.filter((item) => item.id !== id),
  })),

  addMediaTrack: (track) => set((state) => {
    const existingTrack = state.media.tracks.find((item) => (
      item.id === track.id
      || (Boolean(track.externalUrl) && item.externalUrl === track.externalUrl)
      || (Boolean(track.sourceUrl) && item.sourceUrl === track.sourceUrl)
      || (Boolean(track.embedUrl) && item.embedUrl === track.embedUrl)
    ));

    if (existingTrack) {
      return {
        media: {
          ...state.media,
          tracks: state.media.tracks.map((item) => item.id === existingTrack.id ? { ...item, ...track, id: item.id } : item),
          currentTrackId: state.media.currentTrackId ?? existingTrack.id,
        },
      };
    }

    return {
      media: {
        ...state.media,
        tracks: [track, ...state.media.tracks].slice(0, 300),
        currentTrackId: state.media.currentTrackId ?? track.id,
      },
    };
  }),

  setMediaTracks: (tracks) => set((state) => ({
    media: {
      ...state.media,
      tracks: tracks.slice(0, 300),
      currentTrackId: tracks.some((track) => track.id === state.media.currentTrackId) ? state.media.currentTrackId : null,
      isPlaying: false,
      position: 0,
      duration: 0,
      error: null,
    },
  })),

  removeMediaTrack: (id) => set((state) => {
    const tracks = state.media.tracks.filter((track) => track.id !== id);
    const removingCurrent = state.media.currentTrackId === id;
    return {
      media: {
        ...state.media,
        tracks,
        currentTrackId: removingCurrent ? (tracks[0]?.id ?? null) : state.media.currentTrackId,
        isPlaying: removingCurrent ? false : state.media.isPlaying,
        position: removingCurrent ? 0 : state.media.position,
        error: removingCurrent ? null : state.media.error,
      },
    };
  }),

  selectMediaTrack: (id) => set((state) => ({
    media: {
      ...state.media,
      currentTrackId: id && state.media.tracks.some((track) => track.id === id) ? id : null,
      isPlaying: false,
      position: 0,
      duration: 0,
      error: null,
    },
  })),

  setMediaPlaying: (isPlaying) => set((state) => ({ media: { ...state.media, isPlaying } })),
  setMediaPosition: (position) => set((state) => ({ media: { ...state.media, position } })),
  setMediaDuration: (duration) => set((state) => ({ media: { ...state.media, duration } })),
  setMediaError: (error) => set((state) => ({ media: { ...state.media, error } })),
  setMediaPlayMode: (playMode) => set((state) => ({ media: { ...state.media, playMode } })),
  setMusicFullscreen: (musicFullscreen) => set({ musicFullscreen }),
  clearLocalMediaTracks: () => set((state) => {
    const tracks = state.media.tracks.filter((track) => track.id.startsWith('managed-'));
    const keepCurrent = tracks.some((track) => track.id === state.media.currentTrackId);
    return {
      media: {
        ...state.media,
        tracks,
        currentTrackId: keepCurrent ? state.media.currentTrackId : null,
        isPlaying: keepCurrent ? state.media.isPlaying : false,
        position: keepCurrent ? state.media.position : 0,
        error: null,
      },
    };
  }),
  addMusicSource: (source) => set((state) => ({
    musicSources: {
      custom: [...state.musicSources.custom.filter((item) => item.id !== source.id && item.baseUrl !== source.baseUrl), source].slice(-12),
      activeId: source.id,
    },
  })),
  removeMusicSource: (id) => set((state) => ({
    musicSources: {
      custom: state.musicSources.custom.filter((item) => item.id !== id),
      activeId: state.musicSources.activeId === id ? (state.musicSources.custom.find((item) => item.id !== id)?.id ?? '') : state.musicSources.activeId,
    },
  })),
  setActiveMusicSource: (activeId) => set((state) => ({ musicSources: { ...state.musicSources, activeId } })),
    
  toggleSystem: (key) => set((state) => ({
      system: { ...state.system, [key]: !state.system[key] }
  })),
  
  setSystemValue: (key, value) => set((state) => ({
      system: { ...state.system, [key]: value }
  })),

  setControlCenterOpen: (isOpen) => set((state) => ({
      system: { ...state.system, controlCenterOpen: isOpen }
  })),

  setSpotlightOpen: (isOpen) => set((state) => ({
      system: { ...state.system, spotlightOpen: isOpen }
  })),

  setWallpaper: (wallpaper) => set((state) => ({
      system: { ...state.system, wallpaper }
  })),

}),
    {
      name: 'portfolio-settings',
      version: 3,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PortfolioStore> & { media?: Partial<PortfolioStore['media']> & { tracks?: Array<Partial<MediaTrack> & Pick<MediaTrack, 'id' | 'title' | 'artist' | 'platform'>> } };
        const tracks = (persisted.media?.tracks ?? []).map((track): MediaTrack => {
          return {
            ...track,
            playback: track.playback ?? (track.sourceUrl || track.blobId ? 'native' : track.embedUrl ? 'embed' : 'external'),
          };
        }).filter((track) => Boolean(track.sourceUrl || track.blobId || track.embedUrl || track.externalUrl));
        return {
          ...currentState,
          ...persisted,
          system: { ...currentState.system, ...persisted.system },
          // A reload interrupts any download that was still running.
          downloads: (persisted.downloads ?? currentState.downloads).map((item) => (item.status === 'downloading' ? { ...item, status: 'failed' as const, error: 'interrupted' } : item)),
          media: {
            ...currentState.media,
            ...persisted.media,
            tracks,
            currentTrackId: null,
            isPlaying: false,
            position: 0,
            duration: 0,
            error: null,
            playMode: persisted.media?.playMode ?? currentState.media.playMode,
          },
          musicSources: {
            custom: Array.isArray(persisted.musicSources?.custom) ? persisted.musicSources.custom : [],
            // The old built-in public source is gone; keep only sources the visitor added.
            activeId: persisted.musicSources?.custom?.some((item) => item.id === persisted.musicSources?.activeId)
              ? persisted.musicSources.activeId
              : (persisted.musicSources?.custom?.[0]?.id ?? ''),
          },
        };
      },
      partialize: (state) => ({ 
        system: {
          darkMode: state.system.darkMode,
          wallpaper: state.system.wallpaper,
          brightness: state.system.brightness,
          volume: state.system.volume,
        },
        downloads: state.downloads,
        media: { tracks: state.media.tracks.filter((track) => !track.id.startsWith('managed-')), playMode: state.media.playMode },
        musicSources: state.musicSources,
      }),
    }
  )
);
