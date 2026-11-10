import React from 'react';
import { motion } from 'framer-motion';
import { MenuBar } from './MenuBar';
import { Dock } from './Dock';
import { WindowManager } from '../os/WindowManager';
import { ControlCenter } from '../os/ControlCenter';
import { MediaEngine } from '../os/MediaEngine';
import { useStore } from '../../store/useStore';
import { Spotlight } from '../os/Spotlight';
import { useI18n } from '../../i18n';
import { FileText } from 'lucide-react';
import { assetUrl } from '../../lib/assetUrl';
import { useSiteContent } from '../../content/siteContent';
import type { AppId, MediaTrack } from '../../store/useStore';
import { LiuNotificationCenter } from '../os/LiuNotificationCenter';
import { FullscreenPlayer } from '../apps/music/FullscreenPlayer';
import { DEFAULT_WALLPAPER, findWallpaper, wallpaperImageUrl } from '../../data/wallpapers';
import { isPlayableTrack } from '../../lib/musicSources';

const AnimatedBackground: React.FC = () => (
  <div aria-hidden="true" className="liu-animated-wallpaper pointer-events-none absolute inset-0">
    <span /><span /><span />
  </div>
);

const DesktopIcon: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    type="button"
    className="group flex w-16 cursor-pointer flex-col items-center"
    onClick={onClick}
    onDoubleClick={onClick}
  >
    <img
      src={icon}
      alt={label}
      className="h-12 w-12 object-contain drop-shadow-lg transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
    />
    <span className="mt-1 text-center text-[11px] font-medium leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
      {label}
    </span>
  </button>
);

const QuickNoteHotCorner: React.FC<{ label: string; onOpen: () => void }> = ({ label, onOpen }) => {
  const [revealed, setRevealed] = React.useState(false);
  const hideTimer = React.useRef<number | null>(null);

  const reveal = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setRevealed(true);
  };

  const hide = () => {
    hideTimer.current = window.setTimeout(() => setRevealed(false), 260);
  };

  React.useEffect(() => () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }, []);

  return (
    <div className="fixed bottom-0 right-0 z-40 h-16 w-16" onPointerEnter={reveal} onPointerLeave={hide}>
      <motion.button
        type="button"
        title={label}
        aria-label={label}
        onClick={onOpen}
        onPointerDown={(event) => event.stopPropagation()}
        animate={{ x: revealed ? 0 : 30, y: revealed ? 0 : 30, opacity: revealed ? 1 : 0.35, scale: revealed ? 1 : 0.82 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-xl border border-white/75 bg-white/90 text-amber-700 shadow-[0_8px_24px_rgba(15,23,42,0.22)] backdrop-blur-md hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 shadow-sm">
          <span className="absolute right-0 top-0 h-2.5 w-2.5 border-b border-l border-amber-200 bg-white" />
          <FileText size={16} strokeWidth={1.8} />
        </span>
      </motion.button>
    </div>
  );
};

export const Desktop: React.FC = () => {
  const { system, openApp, windows, setMediaTracks } = useStore();
  const { t, language } = useI18n();
  const { content } = useSiteContent();
  const hasVisibleWindow = Object.values(windows).some(
    (windowState) => windowState.isOpen && !windowState.isMinimized,
  );

  React.useEffect(() => {
    if (system.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [system.darkMode]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') openApp('admin');
    if (params.get('share') === 'private' || params.get('share') === 'lan') openApp('lanShare');
    if (params.get('app') === 'maps') openApp('maps');
  }, [openApp]);

  React.useEffect(() => {
    const managedTracks: MediaTrack[] = content.mediaTracks.filter(isPlayableTrack).map((track) => ({
      ...track,
      id: `managed-${track.id.replace(/^managed-/, '')}`,
    }));
    const currentTracks = useStore.getState().media.tracks;
    const localTracks = currentTracks.filter((track) => !track.id.startsWith('managed-'));
    const nextTracks = [...managedTracks, ...localTracks].slice(0, 300);
    const currentSignature = currentTracks.map((track) => `${track.id}:${track.sourceUrl ?? track.embedUrl ?? track.externalUrl ?? ''}`).join('|');
    const nextSignature = nextTracks.map((track) => `${track.id}:${track.sourceUrl ?? track.embedUrl ?? track.externalUrl ?? ''}`).join('|');
    if (currentSignature !== nextSignature) setMediaTracks(nextTracks);
  }, [content.mediaTracks, setMediaTracks]);

  const openShortcut = (appId?: string, targetUrl?: string) => {
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (appId && appId in windows) openApp(appId as AppId);
  };

  const wallpaperOption = findWallpaper(system.wallpaper) ?? findWallpaper(DEFAULT_WALLPAPER);
  const wallpaperUrl = wallpaperOption ? wallpaperImageUrl(wallpaperOption, system.darkMode) : null;
  const [loadedWallpaper, setLoadedWallpaper] = React.useState<string | null>(null);

  // Preload so switching never flashes black; fall back to the bundled Tahoe art if a file fails.
  React.useEffect(() => {
    if (!wallpaperUrl) return undefined;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setLoadedWallpaper(wallpaperUrl); };
    image.onerror = () => {
      const fallback = findWallpaper(DEFAULT_WALLPAPER);
      if (active && fallback) setLoadedWallpaper(wallpaperImageUrl(fallback, system.darkMode));
    };
    image.src = wallpaperUrl;
    return () => { active = false; };
  }, [system.darkMode, wallpaperUrl]);

  const backgroundImage = wallpaperUrl && loadedWallpaper ? `url(${loadedWallpaper})` : 'none';

  return (
    <div
      className="relative h-[100dvh] w-screen select-none overflow-hidden bg-black bg-cover bg-center transition-all duration-700 md:h-screen"
      style={{ backgroundImage, backgroundPosition: wallpaperOption?.portrait ? 'center 30%' : 'center' }}
    >
      {!wallpaperUrl && (
        <AnimatedBackground />
      )}
      <div
        className="pointer-events-none fixed inset-0 z-[100] bg-black transition-opacity duration-300"
        style={{ opacity: ((100 - system.brightness) / 100) * 0.8 }}
      />

      <div className="relative z-10 h-full w-full">
        <MenuBar />

        <div className="absolute right-4 top-16 z-0 grid grid-cols-1 gap-5 sm:right-8 sm:top-24 md:right-12 md:top-32">
          <DesktopIcon icon={assetUrl('icons/mail.ico')} label={t('desktop.contact')} onClick={() => openApp('contact')} />
          <DesktopIcon icon={assetUrl('icons/github.ico')} label={t('desktop.github')} onClick={() => window.open(content.profile.links.github, '_blank')} />
          <DesktopIcon icon={assetUrl('icons/notes.svg')} label={t('desktop.notes')} onClick={() => openApp('notes')} />
          <DesktopIcon icon={assetUrl('icons/settings.ico')} label={t('desktop.toolbox')} onClick={() => openApp('toolbox')} />
          {content.desktopShortcuts.filter((shortcut) => shortcut.enabled).map((shortcut) => (
            <DesktopIcon
              key={shortcut.id}
              icon={shortcut.icon || assetUrl('icons/folder.svg')}
              label={shortcut.label[language]}
              onClick={() => openShortcut(shortcut.appId, shortcut.targetUrl)}
            />
          ))}
        </div>

        <div className={hasVisibleWindow ? 'hidden md:block' : undefined}>
          <QuickNoteHotCorner label={t('notes.quickOpen')} onOpen={() => openApp('notes')} />
        </div>

        <WindowManager />
        <Dock />
        <MediaEngine />
        <ControlCenter />
        <Spotlight />
        <LiuNotificationCenter />
        <FullscreenPlayer />
      </div>
    </div>
  );
};
