import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Minus, Maximize2 } from 'lucide-react';
import { useStore, AppId } from '../../store/useStore';
import { clsx } from 'clsx';
import { useI18n, TranslationKey } from '../../i18n';

interface WindowProps {
  id: AppId;
  children: React.ReactNode;
}

export const Window: React.FC<WindowProps> = ({ id, children }) => {
  const { windows, closeApp, minimizeApp, toggleMaximizeApp, focusApp, updateWindowPosition, updateWindowBounds } = useStore();
  const { t } = useI18n();
  const state = windows[id];
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!state.isOpen) return null;

  const isMaximized = state.isMaximized || isMobile;

  const activateWindowControl = (
    event: React.PointerEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  const activateWindowControlFromKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  const handleFocus = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-window-interactive="true"]')) return;
    focusApp(id);
  };

  const startWindowDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      isMaximized
      || event.button !== 0
      || target.closest('button')
      || target.closest('[data-window-interactive="true"]')
      || !target.closest('[data-window-drag-handle="true"]')
    ) return;

    event.preventDefault();
    event.stopPropagation();
    focusApp(id);

    const pointerId = event.pointerId;
    const titleBar = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = { ...state.position };
    const windowSize = { ...state.size };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();

      const maxX = Math.max(0, window.innerWidth - Math.min(windowSize.width, window.innerWidth));
      const maxY = Math.max(30, window.innerHeight - Math.min(windowSize.height, window.innerHeight));
      const nextX = Math.max(0, Math.min(startPosition.x + moveEvent.clientX - startX, maxX));
      const nextY = Math.max(30, Math.min(startPosition.y + moveEvent.clientY - startY, maxY));

      updateWindowPosition(id, {
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    };

    const stopWindowDrag = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopWindowDrag);
      window.removeEventListener('pointercancel', stopWindowDrag);
      if (titleBar.hasPointerCapture(pointerId)) titleBar.releasePointerCapture(pointerId);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    titleBar.setPointerCapture(pointerId);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopWindowDrag);
    window.addEventListener('pointercancel', stopWindowDrag);
  };

  const handleTitleBarDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    toggleMaximizeApp(id);
  };

  const startResize = (
    direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (isMaximized) return;

    event.preventDefault();
    event.stopPropagation();
    focusApp(id);

    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = { ...state.position };
    const startSize = { ...state.size };
    const minWidth = 420;
    const minHeight = 300;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();

      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let nextX = startPosition.x;
      let nextY = startPosition.y;
      let nextWidth = startSize.width;
      let nextHeight = startSize.height;

      if (direction.includes('e')) {
        nextWidth = startSize.width + deltaX;
      }
      if (direction.includes('s')) {
        nextHeight = startSize.height + deltaY;
      }
      if (direction.includes('w')) {
        nextX = startPosition.x + deltaX;
        nextWidth = startSize.width - deltaX;
      }
      if (direction.includes('n')) {
        nextY = startPosition.y + deltaY;
        nextHeight = startSize.height - deltaY;
      }

      if (nextWidth < minWidth) {
        if (direction.includes('w')) nextX -= minWidth - nextWidth;
        nextWidth = minWidth;
      }
      if (nextHeight < minHeight) {
        if (direction.includes('n')) nextY -= minHeight - nextHeight;
        nextHeight = minHeight;
      }

      nextX = Math.max(0, Math.min(nextX, viewportWidth - minWidth));
      nextY = Math.max(30, Math.min(nextY, viewportHeight - minHeight));
      nextWidth = Math.min(nextWidth, viewportWidth - nextX - 8);
      nextHeight = Math.min(nextHeight, viewportHeight - nextY - 8);

      updateWindowBounds(id, {
        position: { x: Math.round(nextX), y: Math.round(nextY) },
        size: { width: Math.round(nextWidth), height: Math.round(nextHeight) },
      });
    };

    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    const cursor = direction === 'nw' || direction === 'se'
      ? 'nwse-resize'
      : direction === 'ne' || direction === 'sw'
        ? 'nesw-resize'
        : direction === 'e' || direction === 'w'
          ? 'ew-resize'
          : 'ns-resize';

    document.body.style.userSelect = 'none';
    document.body.style.cursor = cursor;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  };

  // Determine animation start state
  const initial = isMaximized ? { 
    opacity: 0, scale: 0.95, x: 0, y: 0 
  } : state.origin ? {
    // If we have an origin, start from there (Scale from Dock effect)
    opacity: 0,
    scale: 0,
    x: state.origin.left,
    y: state.origin.top,
    width: state.origin.width,
    height: state.origin.height,
  } : { 
    // Default fade in if no origin
    opacity: 0, scale: 0.9, x: state.position.x, y: state.position.y 
  };

  return (
    <motion.div
      data-window-id={id}
      initial={initial}
      animate={{ 
        opacity: state.isMinimized ? 0 : 1, 
        scale: state.isMinimized ? 0 : 1,
        // When minimized, go back to origin if possible, else just fade out
        x: state.isMinimized && state.origin ? state.origin.left : (isMaximized ? 0 : state.position.x),
        y: state.isMinimized && state.origin ? state.origin.top : (isMaximized ? 0 : state.position.y),
        width: state.isMinimized && state.origin ? state.origin.width : (isMaximized ? '100%' : state.size.width),
        height: state.isMinimized && state.origin
          ? state.origin.height
          : (isMaximized ? (isMobile ? 'calc(100dvh - 30px)' : 'calc(100% - 30px)') : state.size.height),
        top: isMaximized ? 30 : 0,
        filter: "blur(0px)" 
      }}
      transition={{ 
        type: "spring",
        stiffness: 350,
        damping: 30,
        mass: 0.8 // Slightly heavier for that solid macOS feel
      }}
      onPointerDown={handleFocus}
      style={{ zIndex: state.zIndex }}
      className={clsx(
        "absolute flex flex-col overflow-hidden transition-colors duration-300", // Base positioning
        !isMaximized && "rounded-xl border border-white/20 shadow-2xl bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl dark:border-white/10", // Standard window style
        isMaximized && "rounded-none border-none bottom-0 bg-white/95 dark:bg-[#1e1e1e]/95" // Maximized style
      )}
    >
      {/* Title Bar */}
      <div 
        data-window-titlebar={id}
        data-window-drag-handle="true"
        className="h-11 bg-gradient-to-b from-white/50 to-white/20 dark:from-white/10 dark:to-white/5 border-b border-black/5 dark:border-white/5 flex items-center px-1.5 space-x-1 cursor-default select-none flex-shrink-0 md:h-10 md:px-4 md:space-x-4"
        onPointerDown={startWindowDrag}
        onDoubleClick={handleTitleBarDoubleClick}
      >
        <div className="group flex items-center md:space-x-2">
          <button 
            type="button"
            aria-label={t('window.close')}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => activateWindowControl(event, () => closeApp(id))}
            onKeyDown={(event) => activateWindowControlFromKeyboard(event, () => closeApp(id))}
            className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 md:h-3 md:w-3 md:rounded-full"
          >
            <span className="flex h-3 w-3 items-center justify-center rounded-full border border-red-600 bg-red-500 transition-colors hover:bg-red-600">
              <X size={8} className="text-black/50 opacity-0 md:group-hover:opacity-100" />
            </span>
          </button>
          <button 
            type="button"
            aria-label={t('window.minimize')}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => activateWindowControl(event, () => minimizeApp(id))}
            onKeyDown={(event) => activateWindowControlFromKeyboard(event, () => minimizeApp(id))}
            className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 md:h-3 md:w-3 md:rounded-full"
          >
             <span className="flex h-3 w-3 items-center justify-center rounded-full border border-yellow-600 bg-yellow-500 transition-colors hover:bg-yellow-600">
               <Minus size={8} className="text-black/50 opacity-0 md:group-hover:opacity-100" />
             </span>
          </button>
          <button 
            type="button"
            aria-label={t('window.maximize')}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => {
              if (!isMobile) activateWindowControl(event, () => toggleMaximizeApp(id));
            }}
            onKeyDown={(event) => {
              if (!isMobile) activateWindowControlFromKeyboard(event, () => toggleMaximizeApp(id));
            }}
            className={clsx(
                "flex h-10 w-10 touch-manipulation items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 md:h-3 md:w-3 md:rounded-full",
                isMobile && "opacity-50 cursor-not-allowed"
            )}
            disabled={isMobile}
          >
             <span className="flex h-3 w-3 items-center justify-center rounded-full border border-green-600 bg-green-500 transition-colors hover:bg-green-600">
               <Maximize2 size={8} className="text-black/50 opacity-0 md:group-hover:opacity-100" />
             </span>
          </button>
        </div>
        <div className="flex-1 text-center font-medium text-sm text-gray-700 dark:text-gray-300">
            {t(state.titleKey ?? (`window.${id}` as TranslationKey)) || state.title}
        </div>
        <div className="w-[7.5rem] md:w-14"></div> {/* Spacer for balance */}
      </div>

      {/* Content */}
      <div data-window-content="true" className="custom-scrollbar min-h-0 flex-1 overflow-auto bg-white/50 p-0 dark:bg-[#1c1c1c]/50 md:p-4">
        {children}
      </div>

      {!isMaximized && (
        <>
          <div onPointerDownCapture={(e) => startResize('n', e)} className="absolute top-0 left-3 right-3 h-2 cursor-ns-resize z-10" />
          <div onPointerDownCapture={(e) => startResize('s', e)} className="absolute bottom-0 left-3 right-3 h-2 cursor-ns-resize z-10" />
          <div onPointerDownCapture={(e) => startResize('w', e)} className="absolute left-0 top-3 bottom-3 w-2 cursor-ew-resize z-10" />
          <div onPointerDownCapture={(e) => startResize('e', e)} className="absolute right-0 top-3 bottom-3 w-2 cursor-ew-resize z-10" />
          <div onPointerDownCapture={(e) => startResize('nw', e)} className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-20" />
          <div onPointerDownCapture={(e) => startResize('ne', e)} className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-20" />
          <div onPointerDownCapture={(e) => startResize('sw', e)} className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-20" />
          <div onPointerDownCapture={(e) => startResize('se', e)} className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20" />
        </>
      )}
    </motion.div>
  );
};
