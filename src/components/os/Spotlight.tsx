import React, { useEffect, useMemo, useRef } from 'react';
import { Command, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppId, useStore } from '../../store/useStore';
import { TranslationKey, useI18n } from '../../i18n';

const spotlightApps: Array<{ id: AppId; titleKey: TranslationKey; keywords: string[] }> = [
  { id: 'maps', titleKey: 'dock.maps', keywords: ['maps', 'globe', '地图', '地球', '直播', 'world'] },
  { id: 'about', titleKey: 'window.about', keywords: ['about', 'me', '关于', '个人'] },
  { id: 'projects', titleKey: 'window.projects', keywords: ['projects', 'project', '项目', '作品'] },
  { id: 'experience', titleKey: 'window.experience', keywords: ['experience', 'work', '经历', '工作'] },
  { id: 'skills', titleKey: 'window.skills', keywords: ['skills', 'tools', '技能', '工具'] },
  { id: 'contact', titleKey: 'window.contact', keywords: ['contact', 'email', '联系', '邮箱'] },
  { id: 'safari', titleKey: 'window.safari', keywords: ['safari', 'browser', '浏览器'] },
  { id: 'vscode', titleKey: 'window.vscode', keywords: ['code', 'vscode', '代码'] },
  { id: 'terminal', titleKey: 'window.terminal', keywords: ['terminal', 'shell', '终端'] },
  { id: 'games', titleKey: 'window.games', keywords: ['games', 'game', '游戏'] },
  { id: 'music', titleKey: 'window.music', keywords: ['music', 'song', 'player', '音乐', '听歌', '歌曲', '播放器'] },
  { id: 'notes', titleKey: 'window.notes', keywords: ['notes', 'note', '备忘录', '笔记'] },
  { id: 'downloads', titleKey: 'window.downloads', keywords: ['downloads', 'download', '下载'] },
  { id: 'settings', titleKey: 'window.settings', keywords: ['settings', '设置'] },
];

export const Spotlight: React.FC = () => {
  const { system, setSpotlightOpen, openApp } = useStore();
  const { t } = useI18n();
  const [query, setQuery] = React.useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return spotlightApps.filter((app) => {
      const haystack = [t(app.titleKey), ...app.keywords].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, t]);

  useEffect(() => {
    if (system.spotlightOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [system.spotlightOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setSpotlightOpen(false);
    };
    if (system.spotlightOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [system.spotlightOpen, setSpotlightOpen]);

  const openResult = (id: AppId) => {
    openApp(id);
    setSpotlightOpen(false);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (results[0]) openResult(results[0].id);
  };

  return (
    <AnimatePresence>
      {system.spotlightOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/20 pt-[20vh] backdrop-blur-sm transition-all">
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="mx-4 flex w-full max-w-[600px] flex-col overflow-hidden rounded-xl border border-white/20 bg-[#e3e3e3]/80 shadow-2xl backdrop-blur-2xl dark:bg-[#1e1e1e]/80"
          >
            <form onSubmit={submitSearch} className="relative flex items-center gap-3 p-4">
              <Search size={24} className="text-gray-500 dark:text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') setSpotlightOpen(false); }}
                placeholder={t('spotlight.placeholder')}
                aria-label={t('spotlight.placeholder')}
                className="flex-1 border-none bg-transparent text-2xl font-light text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              {!query && <span className="pointer-events-none hidden rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600 sm:block">{t('spotlight.escape')}</span>}
            </form>

            {query && (
              <div className="border-t border-gray-300/50 bg-white/50 p-2 dark:border-white/10 dark:bg-black/20">
                {results.length ? results.map((app, index) => (
                  <button key={app.id} type="button" onClick={() => openResult(app.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-blue-500 hover:text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/10 dark:bg-white/10"><Command size={16} /></span>
                    <span className="flex-1 text-sm font-medium">{t(app.titleKey)}</span>
                    {index === 0 && <span className="text-[11px] opacity-60">Enter</span>}
                  </button>
                )) : <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{t('spotlight.noResults')}</div>}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
