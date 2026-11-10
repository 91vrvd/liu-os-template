import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useSiteContent } from '../../content/siteContent';

export const ProfileSticker: React.FC = () => {
  const { openApp } = useStore();
  const { content } = useSiteContent();
  const [isActive, setIsActive] = useState(false);

  return (
    <>
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-0 z-40 bg-black/10 backdrop-blur-[7px]"
          />
        )}
      </AnimatePresence>

      <div
        className="relative z-50 flex select-none flex-col items-center"
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
      >
        <button
          type="button"
          className="absolute left-1/2 top-0 h-[120px] w-[120px] -translate-x-1/2"
          onClick={() => openApp('about')}
          aria-label="Open about"
        />

        <AnimatePresence>
          {!isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none flex cursor-pointer flex-col items-center"
            >
              <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-gradient-to-br from-sky-300 via-emerald-200 to-amber-100 text-4xl font-bold text-sky-700 shadow-lg ring-4 ring-white/20">
                {content.profile.name.slice(0, 2)}
              </div>
              <span className="mt-3 rounded-full bg-black/20 px-3 py-1 text-sm font-medium text-white drop-shadow-md backdrop-blur-sm">
                {content.profile.name}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 360, damping: 22 }}
              className="pointer-events-none mt-4 flex flex-col items-center rounded-3xl bg-white/18 px-6 py-5 text-center text-white shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 via-emerald-200 to-amber-100 text-4xl font-bold text-sky-700 shadow-lg">
                {content.profile.name.slice(0, 2)}
              </div>
              <p className="whitespace-nowrap text-[20px] leading-snug drop-shadow-md" style={{ fontFamily: 'Caveat, cursive' }}>
                Building a quieter personal OS.
              </p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openApp('about');
                }}
                className="pointer-events-auto mt-3 rounded-full px-5 py-2 text-xs font-semibold shadow-sm transition-all hover:shadow-md active:scale-95"
                style={{
                  backgroundColor: 'rgba(235, 235, 235, 0.85)',
                  color: '#1a1a1a',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Read about me
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
