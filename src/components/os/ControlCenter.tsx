import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Wifi, Bluetooth, Moon, Sun, Volume2, Maximize, Airplay, LayoutTemplate, Pause, Play, SkipBack, SkipForward, Music2, ChevronLeft, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../../i18n';
import { canControlMediaTrack, seekMediaTrack, skipTrack, togglePlayback } from './mediaController';
import { platformLabel } from '../../lib/musicSources';
import { mediaErrorText } from './mediaErrors';
import { Scrubber } from './Scrubber';
import { WALLPAPERS, findWallpaper, wallpaperThumb } from '../../data/wallpapers';

export const ControlCenter: React.FC = () => {
  const { system, toggleSystem, setSystemValue, setControlCenterOpen, media, openApp, setMediaPosition } = useStore();
  const { t, language } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const activeTrack = media.tracks.find((track) => track.id === media.currentTrackId) ?? null;
  const currentWallpaper = findWallpaper(system.wallpaper);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const toggleBtn = document.getElementById('control-center-toggle');
        if (toggleBtn && toggleBtn.contains(event.target as Node)) return;
        const languageBtn = document.getElementById('language-switcher-toggle');
        if (languageBtn && languageBtn.contains(event.target as Node)) return;
        setControlCenterOpen(false);
      }
    };

    if (system.controlCenterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [system.controlCenterOpen, setControlCenterOpen]);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  const openMusic = () => {
    openApp('music');
    setControlCenterOpen(false);
  };
  const openFullscreen = () => {
    if (!activeTrack) { openMusic(); return; }
    useStore.getState().setMusicFullscreen(true);
    setControlCenterOpen(false);
  };


  const siteControlsAvailable = canControlMediaTrack(activeTrack);
  const statusLabel = !activeTrack
    ? t('controlCenter.notPlaying')
    : activeTrack.playback === 'embed' ? t('controlCenter.officialPlayer')
      : media.isPlaying ? t('controlCenter.nowPlaying') : (language === 'zh' ? '已暂停' : 'Paused');

  return (
        <motion.div
            ref={menuRef}
            initial={false}
            animate={system.controlCenterOpen
              ? { opacity: 1, scale: 1, y: 0, x: 0 }
              : { opacity: 0, scale: 0.95, y: -20, x: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            aria-hidden={!system.controlCenterOpen}
            style={{
              pointerEvents: system.controlCenterOpen ? 'auto' : 'none',
              visibility: system.controlCenterOpen ? 'visible' : 'hidden',
            }}
            className="fixed top-9 right-4 max-h-[calc(100vh-3.5rem)] w-80 overflow-y-auto overscroll-contain bg-[#e3e3e3]/70 dark:bg-[#1e1e1e]/70 backdrop-blur-2xl rounded-2xl p-3 shadow-[0_0_20px_rgba(0,0,0,0.2)] border border-white/20 z-[60] text-black dark:text-white"
        >
            <div className="grid grid-flow-row gap-3">
                {/* Top Section: Toggles */}
                 <div className="flex gap-3 h-[136px]">
                     {/* Connectivity Module */}
                     <div className="flex-1 bg-white/50 dark:bg-[#323232]/50 rounded-2xl p-3 flex flex-col justify-between shadow-[0_1px_5px_rgba(0,0,0,0.05)]">
                         {/* Wifi */}
                         <div className="flex items-center gap-3 group cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded-lg p-1 transition-colors">
                             <button
                                onClick={(e) => { e.stopPropagation(); toggleSystem('wifi'); }} 
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors duration-300 shadow-sm ${system.wifi ? 'bg-[#007aff]' : 'bg-[#808080]'}`}
                             >
                                 <Wifi size={16} strokeWidth={2.5} />
                             </button>
                             <div className="flex flex-col">
                                 <span className="text-[13px] font-semibold leading-tight">{t('controlCenter.wifi')}</span>
                                 <span className="text-[11px] opacity-60 leading-tight">{system.wifi ? 'Home_5G' : t('controlCenter.off')}</span>
                             </div>
                         </div>
                         
                         {/* Bluetooth */}
                         <div className="flex items-center gap-3 group cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded-lg p-1 transition-colors">
                             <button 
                                onClick={(e) => { e.stopPropagation(); toggleSystem('bluetooth'); }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors duration-300 shadow-sm ${system.bluetooth ? 'bg-[#007aff]' : 'bg-[#808080]'}`}
                             >
                                 <Bluetooth size={16} strokeWidth={2.5} />
                             </button>
                             <div className="flex flex-col">
                                 <span className="text-[13px] font-semibold leading-tight">{t('controlCenter.bluetooth')}</span>
                                 <span className="text-[11px] opacity-60 leading-tight">{system.bluetooth ? t('controlCenter.on') : t('controlCenter.off')}</span>
                             </div>
                         </div>

                          {/* Airdrop */}
                          <div className="flex items-center gap-3 group cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded-lg p-1 transition-colors">
                             <button 
                                onClick={(e) => { e.stopPropagation(); toggleSystem('airdrop'); }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors duration-300 shadow-sm ${system.airdrop ? 'bg-[#007aff]' : 'bg-[#808080]'}`}
                             >
                                 <Airplay size={16} strokeWidth={2.5} />
                             </button>
                             <div className="flex flex-col">
                                 <span className="text-[13px] font-semibold leading-tight">{t('controlCenter.airdrop')}</span>
                                 <span className="text-[11px] opacity-60 leading-tight">{system.airdrop ? t('controlCenter.contactsOnly') : t('controlCenter.off')}</span>
                             </div>
                         </div>
                     </div>

                     {/* Other Toggles Module */}
                     <div className="flex-1 grid grid-cols-2 gap-3 h-full">
                         {/* Dark Mode */}
                         <div 
                             className={`bg-white/50 dark:bg-[#323232]/50 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:bg-white/80 dark:hover:bg-[#323232]/80 shadow-[0_1px_5px_rgba(0,0,0,0.05)] active:scale-95 ${system.darkMode ? 'bg-white/60 dark:bg-[#323232]/80' : ''}`}
                             onClick={() => toggleSystem('darkMode')}
                         >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${system.darkMode ? 'bg-black text-white' : 'bg-[#e5e5e5] text-black'}`}>
                                {system.darkMode ? <Moon size={16} fill="currentColor" strokeWidth={0} /> : <Sun size={18} strokeWidth={2} />}
                            </div>
                            <span className="text-[11px] font-semibold">{t('controlCenter.darkMode')}</span>
                         </div>
                         
                         {/* Fullscreen */}
                         <div 
                            className="bg-white/50 dark:bg-[#323232]/50 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:bg-white/80 dark:hover:bg-[#323232]/80 shadow-[0_1px_5px_rgba(0,0,0,0.05)] active:scale-95"
                            onClick={toggleFullscreen}
                         >
                            <div className="w-8 h-8 rounded-full bg-[#e5e5e5] dark:bg-gray-600 text-black dark:text-white flex items-center justify-center">
                                <Maximize size={16} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-semibold">{t('controlCenter.fullscreen')}</span>
                         </div>

                         {/* Wallpaper picker */}
                         <button
                            type="button"
                            aria-expanded={wallpaperPickerOpen}
                            className={`bg-white/50 dark:bg-[#323232]/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 hover:bg-white/80 dark:hover:bg-[#323232]/80 col-span-2 shadow-[0_1px_5px_rgba(0,0,0,0.05)] active:scale-95 ${wallpaperPickerOpen ? 'ring-2 ring-[#007aff]/60' : ''}`}
                            onClick={() => setWallpaperPickerOpen((value) => !value)}
                         >
                             <div className="w-8 h-8 overflow-hidden rounded-full bg-[#e5e5e5] dark:bg-gray-600 text-black dark:text-white flex items-center justify-center">
                                {currentWallpaper ? <span className="h-full w-full" style={{ background: wallpaperThumb(currentWallpaper, system.darkMode) }} /> : <LayoutTemplate size={16} strokeWidth={2.5} />}
                             </div>
                             <span className="max-w-full truncate px-2 text-[11px] font-semibold">{t('controlCenter.wallpapers')}: <span className="opacity-70">{currentWallpaper ? currentWallpaper.name[language] : system.wallpaper}</span></span>
                         </button>
                     </div>
                 </div>

                 {wallpaperPickerOpen && (
                   <div className="rounded-2xl bg-white/50 p-3 shadow-[0_1px_5px_rgba(0,0,0,0.05)] dark:bg-[#323232]/50">
                     <div className="mb-2 flex items-center gap-1">
                       <button type="button" aria-label={language === 'zh' ? '收起壁纸' : 'Close wallpapers'} onClick={() => setWallpaperPickerOpen(false)} className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft size={14} /></button>
                       <span className="text-[12px] font-semibold">{t('controlCenter.wallpapers')}</span>
                     </div>
                     {(['original', 'apple', 'dynamic'] as const).map((group) => {
                       const items = WALLPAPERS.filter((item) => item.group === group);
                       if (!items.length) return null;
                       return (
                         <div key={group} className="mb-2 last:mb-0">
                           <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide opacity-50">{group === 'original' ? (language === 'zh' ? 'Liu OS 原创' : 'Liu OS Originals') : group === 'apple' ? (language === 'zh' ? 'Apple 系统壁纸' : 'Apple System') : (language === 'zh' ? '动态' : 'Dynamic')}</div>
                           <div className="grid grid-cols-3 gap-2">
                             {items.map((item) => {
                               const selected = system.wallpaper === item.id;
                               return (
                                 <button key={item.id} type="button" onClick={() => useStore.getState().setWallpaper(item.id)} title={item.name[language]} className="group text-left">
                                   <span className={`relative block aspect-[16/10] overflow-hidden rounded-lg border-2 bg-cover bg-center transition ${selected ? 'border-[#007aff]' : 'border-transparent group-hover:border-black/15 dark:group-hover:border-white/20'}`} style={{ background: wallpaperThumb(item, system.darkMode) }}>
                                     {selected && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#007aff] text-white"><Check size={10} strokeWidth={3} /></span>}
                                   </span>
                                   <span className="mt-1 block truncate text-[10px] opacity-70">{item.name[language]}</span>
                                 </button>
                               );
                             })}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}

                 {/* Display & Sound */}
                 <div className="bg-white/50 dark:bg-[#323232]/50 rounded-2xl p-3 space-y-4 shadow-[0_1px_5px_rgba(0,0,0,0.05)]">
                     {/* Brightness */}
                     <div className="space-y-2">
                         <div className="flex items-center justify-between px-1">
                             <div className="text-[11px] font-semibold opacity-80 uppercase tracking-wide">{t('controlCenter.display')}</div>
                         </div>
                         <div className="relative h-7 bg-[#e5e5e5] dark:bg-black/40 rounded-full overflow-hidden flex items-center group cursor-ew-resize border border-black/5 dark:border-white/5">
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.1)] transition-all duration-75"
                                style={{ width: `${system.brightness}%` }}
                            />
                            <div className="absolute left-2 z-10 pointer-events-none">
                                <Sun size={14} className="text-gray-500 dark:text-gray-400 fill-current opacity-80" />
                            </div>
                            <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                value={system.brightness}
                                onChange={(e) => setSystemValue('brightness', parseInt(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                         </div>
                     </div>

                      {/* Sound */}
                      <div className="space-y-2">
                         <div className="flex items-center justify-between px-1">
                             <div className="text-[11px] font-semibold opacity-80 uppercase tracking-wide">{t('controlCenter.sound')}</div>
                         </div>
                         <div className="relative h-7 bg-[#e5e5e5] dark:bg-black/40 rounded-full overflow-hidden flex items-center group cursor-ew-resize border border-black/5 dark:border-white/5">
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.1)] transition-all duration-75"
                                style={{ width: `${system.volume}%` }}
                            />
                            <div className="absolute left-2 z-10 pointer-events-none">
                                <Volume2 size={14} className="text-gray-500 dark:text-gray-400 fill-current opacity-80" />
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={system.volume}
                                onChange={(e) => setSystemValue('volume', parseInt(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                         </div>
                     </div>
                 </div>

                 {/* Now Playing — follows the compact macOS Control Center module */}
                 <div className="rounded-2xl bg-white/50 p-3 shadow-[0_1px_5px_rgba(0,0,0,0.05)] dark:bg-[#323232]/50">
                   <div className="flex items-center gap-3">
                     <button type="button" onClick={openFullscreen} aria-label={language === 'zh' ? '全屏播放' : 'Full-screen player'} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-br from-[#fb5c74] to-[#fa233b] text-white shadow-md transition-transform active:scale-95">
                       {activeTrack?.cover
                         ? <img src={activeTrack.cover} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                         : <span className="flex h-full w-full items-center justify-center"><Music2 size={22} strokeWidth={2.2} /></span>}
                     </button>
                     <button type="button" onClick={openMusic} className="min-w-0 flex-1 text-left">
                       <div className="text-[10px] font-medium opacity-55">{statusLabel}</div>
                       <div className="truncate text-[13px] font-semibold leading-tight">{activeTrack?.title ?? (language === 'zh' ? '音乐' : 'Music')}</div>
                       <div className="truncate text-[11px] leading-tight opacity-60">{activeTrack?.artist || (activeTrack ? platformLabel(activeTrack.platform, language) : (language === 'zh' ? '搜索歌曲或粘贴链接' : 'Search songs or paste a link'))}</div>
                     </button>
                     <div className="flex shrink-0 items-center gap-1">
                       <button type="button" aria-label={t('controlCenter.previous')} disabled={!media.tracks.length} onClick={() => skipTrack(-1)} className="rounded-full p-1.5 opacity-80 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><SkipBack size={16} fill="currentColor" /></button>
                       <button type="button" aria-label={t('controlCenter.playPause')} disabled={!media.tracks.length} onClick={() => (activeTrack && !siteControlsAvailable ? openMusic() : togglePlayback())} className="rounded-full p-1.5 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10">{media.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
                       <button type="button" aria-label={t('controlCenter.next')} disabled={!media.tracks.length} onClick={() => skipTrack(1)} className="rounded-full p-1.5 opacity-80 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><SkipForward size={16} fill="currentColor" /></button>
                     </div>
                   </div>
                   {activeTrack && siteControlsAvailable && (
                     <Scrubber className="mt-2" position={media.position} duration={media.duration} label={t('controlCenter.seek')} onSeek={(position) => { setMediaPosition(position); seekMediaTrack(activeTrack, position); }} />
                   )}
                   {activeTrack && !siteControlsAvailable && (
                     <button type="button" onClick={openMusic} className="mt-2 w-full rounded-lg bg-black/5 px-2 py-1.5 text-[10px] font-medium opacity-75 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10">{language === 'zh' ? '这首歌需要在官方播放器里播放，点此打开音乐' : 'This song plays in its official player — open Music'}</button>
                   )}
                   {media.error && <div className="mt-2 rounded-lg bg-red-500/10 px-2 py-1 text-[10px] text-red-600 dark:text-red-300">{mediaErrorText(media.error, language)}</div>}
                 </div>
            </div>
        </motion.div>
  );
};
