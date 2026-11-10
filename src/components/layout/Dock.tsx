import React from 'react';
import { motion, MotionValue, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useStore, AppId } from '../../store/useStore';
import { useI18n, TranslationKey } from '../../i18n';
import { assetUrl } from '../../lib/assetUrl';

interface DockItemProps {
  id: string;
  icon: string | React.ReactNode;
  label: string;
  isOpen: boolean;
  badge?: number;
  mouseX: MotionValue<number>;
  onClick: () => void;
  onBadgeClick?: () => void;
}

const DockItem: React.FC<DockItemProps> = ({ id, icon: Icon, label, isOpen, badge = 0, mouseX, onClick, onBadgeClick }) => {
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = document.getElementById(`dock-item-${id}`)?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  // Phones: two rows of comfortably tappable icons, no magnification (there is no hover on touch).
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const baseSize = isMobile ? 34 : 45;
  const hoverSize = isMobile ? 34 : 90;
  const widthSync = useTransform(distance, [-150, 0, 150], [baseSize, hoverSize, baseSize]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 350, damping: 20 });

  return (
    <motion.div
      id={`dock-item-${id}`}
      style={{ width }}
      className="aspect-square flex shrink-0 flex-col items-center justify-end relative group cursor-pointer mb-1 mx-[5px] sm:mx-1"
      onClick={onClick}
    >
        {/* No background container - pure icon float */}
        {typeof Icon === 'string' ? (
          <motion.img
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              src={Icon}
              alt={label}
              style={id === 'maps' ? { scale: 224 / 206 } : undefined}
              className="w-full h-full object-contain drop-shadow-lg transition-all active:brightness-75 active:scale-95"
          />
        ) : (
          <motion.span
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex h-full w-full items-center justify-center drop-shadow-lg transition-transform active:scale-95"
            aria-label={label}
          >
            {Icon}
          </motion.span>
        )}

        {badge > 0 && (
          <button
            type="button"
            aria-label={`${label} · ${badge}`}
            onClick={(event) => {
              event.stopPropagation();
              onBadgeClick?.();
            }}
            className="absolute -right-1 -top-1 z-20 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#ff3b30] px-1 text-[10px] font-bold leading-none text-white shadow-md dark:border-[#202124]"
          >
            {badge > 99 ? '99+' : badge}
          </button>
        )}
        
        {/* Label Tooltip */}
        <span className="absolute -top-14 z-30 bg-gray-900/50 backdrop-blur-md border border-white/10 text-white/90 text-[12px] font-medium px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
            {label}
        </span>

      {/* Open Indicator */}
      {isOpen && (
        <div className="absolute -bottom-1 w-1 h-1 bg-white/80 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
      )}
    </motion.div>
  );
};

export const Dock: React.FC = () => {
  const mouseX = useMotionValue(Infinity);
  const { windows, openApp } = useStore();
  const { t } = useI18n();
  const activeDownloads = useStore((state) => state.downloads.filter((item) => item.status === 'downloading').length);
  const hasVisibleWindow = Object.values(windows).some(
    (windowState) => windowState.isOpen && !windowState.isMinimized,
  );

  const apps: { id: AppId; icon: string | React.ReactNode; labelKey: TranslationKey; badge?: number }[] = [
    { id: 'about', icon: assetUrl('icons/finder.ico'), labelKey: 'dock.finder' },
    { id: 'safari', icon: assetUrl('icons/safari.ico'), labelKey: 'dock.safari' },
    { id: 'vscode', icon: assetUrl('icons/vscode.ico'), labelKey: 'dock.vscode' },
    { id: 'terminal', icon: assetUrl('icons/terminal.svg'), labelKey: 'dock.terminal' },
    { id: 'projects', icon: assetUrl('icons/projects.ico'), labelKey: 'dock.projects' },
    { id: 'experience', icon: assetUrl('icons/anythingllm.ico'), labelKey: 'dock.experience' },
    { id: 'skills', icon: assetUrl('icons/typora.png'), labelKey: 'dock.skills' },
    { id: 'contact', icon: assetUrl('icons/mail.ico'), labelKey: 'dock.contact' },
    { id: 'maps', icon: assetUrl('icons/maps.png'), labelKey: 'dock.maps' },
    { id: 'music', icon: assetUrl('icons/music.svg'), labelKey: 'dock.music' },
    { id: 'games', icon: assetUrl('icons/games.png'), labelKey: 'dock.games' },
    { id: 'notes', icon: assetUrl('icons/notes.svg'), labelKey: 'dock.notes' },
    { id: 'settings', icon: assetUrl('icons/settings.ico'), labelKey: 'dock.settings' },
  ];

  const handleAppClick = (id: AppId) => {
    // Capture the origin rect of the icon for animation
    const iconElement = document.getElementById(`dock-item-${id}`);
    const origin = iconElement?.getBoundingClientRect();

    const appState = windows[id];
    if (appState.isOpen) {
        if (appState.isMinimized) {
            openApp(id, origin); // Restore from minimized
        } else {
            openApp(id, origin);
        }
    } else {
        openApp(id, origin);
    }
  };

  return (
    <div 
      className={`mobile-dock-shell fixed bottom-6 left-1/2 z-50 flex w-full -translate-x-1/2 justify-center sm:bottom-4 sm:max-w-fit ${
        hasVisibleWindow ? 'mobile-dock-shell--hidden' : ''
      }`}
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      {/* Dock container with relative positioning */}
      <div className="relative max-w-[calc(100vw-0.75rem)] overflow-hidden rounded-2xl sm:max-w-none sm:overflow-visible">
        {/* Background layer - scales with content */}
        <div className="absolute inset-0 sm:top-auto sm:h-[65px] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl" />
        
        {/* Icons container - centered, no scroll */}
        <div className="relative flex max-w-[350px] flex-wrap items-end justify-center gap-y-1.5 px-2 pb-2 pt-2 sm:max-w-none sm:flex-nowrap sm:justify-center sm:gap-y-0 sm:px-3 sm:pb-2 sm:pt-0">
          {apps.map((app) => (
            <DockItem
              key={app.id}
              id={app.id}
              icon={app.icon}
              label={t(app.labelKey)}
              isOpen={windows[app.id].isOpen}
              badge={app.badge}
              mouseX={mouseX}
              onClick={() => handleAppClick(app.id)}
            />
          ))}

          {/* Separator */}
          <div className="hidden h-6 sm:block sm:h-10 w-[1px] bg-white/20 mx-1 sm:mx-2 mb-2 sm:mb-2 self-end flex-shrink-0" />

          {/* Placeholder Folders (Downloads, Trash) */}
          <DockItem
            id="downloads"
            icon={assetUrl('icons/folder.svg')}
            label={t('dock.downloads')}
            isOpen={windows.downloads?.isOpen || false}
            badge={activeDownloads}
            mouseX={mouseX}
            onClick={() => handleAppClick('downloads')}
          />
          <div className="hidden sm:contents">
            <DockItem
              id="trash"
              icon={assetUrl('icons/trash.svg')}
              label={t('dock.trash')}
              isOpen={false}
              mouseX={mouseX}
              onClick={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
