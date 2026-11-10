import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../i18n';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useI18n();
  const nextLanguage = language === 'zh' ? 'en' : 'zh';

  return (
    <button
      type="button"
      id="language-switcher-toggle"
      className="hover:bg-white/10 p-1 rounded transition-colors"
      aria-label="Switch language"
      aria-pressed={language === 'zh'}
      title={language === 'zh' ? 'Switch to English' : '切换为中文'}
      onClick={() => setLanguage(nextLanguage)}
    >
      <svg
        className="w-[18px] h-[18px]"
        viewBox="0 0 24 24"
        role="img"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="2.75"
          y="3.25"
          width="18.5"
          height="17.5"
          rx="4.4"
          fill="rgba(255,255,255,0.96)"
        />
        <AnimatePresence initial={false} mode="wait">
          <motion.text
            key={language}
            x="12"
            y="12.7"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#2388c5"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
            fontSize={language === 'zh' ? 11.5 : 8.4}
            fontWeight={language === 'zh' ? 700 : 800}
            letterSpacing={language === 'zh' ? 0 : -0.25}
            initial={{ opacity: 0, y: 1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -1 }}
            transition={{ duration: 0.14 }}
          >
            {language === 'zh' ? '中' : 'EN'}
          </motion.text>
        </AnimatePresence>
      </svg>
    </button>
  );
};
