import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Heart, Shuffle, Maximize2, Minimize2, List, X, Volume2, HelpCircle, Play, Pause, Square, Search, ExternalLink } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { assetUrl } from '../../../lib/assetUrl';
import Globe from './Globe';
import LivePlayer from './LivePlayer';
import { readStreamHealth } from './streamHealth';
import Ambience from './Ambience';
import { useWeather } from './useWeather';
import { places, matches, localTime, readSaved, save, type Place, type Filter, type Group } from './model';
import './maps.css';

const filterInfo: Record<Filter, [string, string, string]> = {
  all: ['全部时段', 'Any time', '#88a7b4'], day: ['此刻白天', 'Daylight', '#ead18b'], golden: ['晨昏时分', 'Dawn & dusk', '#f1ac76'], night: ['此刻夜间', 'After dark', '#9eaff2'],
  clear: ['阳光普照', 'Sunshine', '#ead18b'], cloud: ['阴天', 'Overcast', '#b4c1cc'], rain: ['正在下雨', 'Raining', '#62b1dc'], snow: ['正在下雪', 'Snowing', '#e6f1ff'], season: ['当季看点', 'In season', '#81c59b'],
};
const groups: [Group | 'all', string, string][] = [['all', '全部', 'All'], ['city', '城市现场', 'Cities'], ['wildlife', '动物现场', 'Animals'], ['transport', '交通现场', 'Transport']];
const categories: Record<string, [string, string]> = { penguin: ['企鹅', 'Penguins'], bear: ['熊', 'Bears'], savanna: ['非洲草原', 'Savanna'], bird: ['鸟巢与喂鸟台', 'Birds & nests'], ocean: ['海洋与水族馆', 'Ocean & aquariums'], zoo: ['动物园', 'Zoos'], forest: ['森林动物', 'Forest wildlife'], aviation: ['飞机', 'Aviation'], rail: ['铁路', 'Railways'], maritime: ['船舶与运河', 'Ships & canals'] };

export default function MapsApp() {
  const { language, setLanguage } = useI18n();
  const english = language === 'en';
  const text = (zh: string, en: string) => english ? en : zh;
  const [now, setNow] = useState(Date.now);
  const [group, setGroup] = useState<Group | 'all'>('city');
  const { weather, loading } = useWeather(group);
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('all');
  const filters: Filter[] = group === 'city' || group === 'all' ? ['all', 'day', 'golden', 'night', 'clear', 'cloud', 'rain', 'snow'] : group === 'wildlife' ? ['all', 'day', 'golden', 'night', 'season'] : ['all', 'day', 'golden', 'night'];
  const categoryOptions = [...new Set(places.filter(p => p.group === group).map(p => p.category).filter((c): c is string => !!c))];
  const [selected, setSelected] = useState<Place | null>(null);
  const [health, setHealth] = useState(readStreamHealth);
  useEffect(() => {
    const refresh = () => setHealth(readStreamHealth());
    window.addEventListener('liu-live-health', refresh);
    return () => window.removeEventListener('liu-live-health', refresh);
  }, []);
  const [list, setList] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyLive, setOnlyLive] = useState(true);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const value = readSaved<unknown>('liu-world-favorites', []);
    return Array.isArray(value) ? value.filter(id => typeof id === 'string' && places.some(p => p.id === id)) : [];
  });
  const [immersive, setImmersive] = useState(false);
  const [mixer, setMixer] = useState(false);
  const [help, setHelp] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [focus, setFocus] = useState<{ started: number; duration: number; pausedAt: number | null; paused: number } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const visited = useRef(new Set<string>());
  const root = useRef<HTMLElement>(null);
  const drag = useDragControls();
  const [mobile, setMobile] = useState(false);
  const [tour, setTour] = useState(false);
  const [panelVersion, setPanelVersion] = useState(0);
  useEffect(() => { const tick = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => { const observer = new ResizeObserver(entries => setMobile(entries[0].contentRect.width < 700)); if (root.current) observer.observe(root.current); return () => observer.disconnect(); }, []);
  useEffect(() => { save('liu-world-favorites', favorites); }, [favorites]);
  const pool = useMemo(() => places.filter(p => (group === 'all' || p.group === group) && (category === 'all' || p.category === category) && (!onlyLive || (p.videoId && !health[p.id])) && (!onlyFavorites || favorites.includes(p.id)) && (!query || `${p.zh} ${p.en} ${p.country} ${p.keywords || ''}`.toLowerCase().includes(query.trim().toLowerCase()))), [group, category, onlyLive, onlyFavorites, favorites, query, health]);
  const visible = useMemo(() => pool.filter(p => matches(p, filter, now, weather[p.id])).sort((a, b) => localTime(a, now, weather[a.id]).localeCompare(localTime(b, now, weather[b.id]))), [pool, filter, now, weather]);
  // Keep the globe's marker collection stable while only the clock ticks.
  const markerSignature = visible.map(p => p.id).join(',');
  const markers = useMemo(() => markerSignature.split(',').map(id => places.find(p => p.id === id)).filter((p): p is Place => !!p), [markerSignature]);
  const select = (place: Place) => { setSelected(place); visited.current.add(english ? place.en : place.zh); if (mobile) setList(false); };
  const next = (step: number) => { if (visible.length) { const index = visible.findIndex(p => p.id === selected?.id); select(visible[index < 0 ? step > 0 ? 0 : visible.length - 1 : (index + step + visible.length) % visible.length]); } };
  const tourRef = useRef(() => next(1)); tourRef.current = () => next(1);
  useEffect(() => { if (!tour) return; const timer = setInterval(() => tourRef.current(), 45000); return () => clearInterval(timer); }, [tour]);
  const elapsed = focus ? Math.max(0, Math.floor(((focus.pausedAt ?? now) - focus.started - focus.paused) / 1000)) : 0;
  const timerValue = focus ? (focus.duration ? Math.max(0, focus.duration * 60 - elapsed) : elapsed) : minutes * 60;
  const finishRef = useRef(() => {});
  finishRef.current = () => {
    setSummary(text(`专注了 ${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒。${visited.current.size ? `陪你走过：${[...visited.current].join('、')}。` : '谢谢你把这一小段时间留给自己。'}`, `${Math.floor(elapsed / 60)}m ${elapsed % 60}s of focus.${visited.current.size ? ` In the company of ${[...visited.current].join(', ')}.` : ' A little time for yourself.'}`));
    setFocus(null);
  };
  useEffect(() => { if (focus && focus.duration > 0 && timerValue === 0) finishRef.current(); }, [focus, timerValue]);
  const toggleFavorite = (id: string) => setFavorites(old => old.includes(id) ? old.filter(p => p !== id) : [...old, id]);

  return <section ref={root} className={`world-app ${immersive ? 'world-immersive' : ''} ${selected ? 'world-selected' : ''} ${group === 'wildlife' || group === 'transport' ? 'world-has-subgroup' : ''}`} tabIndex={0} aria-label={text('地图 · 此刻的世界', 'Maps · The world right now')} onKeyDown={event => {
    if (event.key === 'Escape') { setHelp(false); setSummary(null); setImmersive(false); setMixer(false); return; }
    if ((event.target as HTMLElement).closest('input,select,textarea,button')) return;
    if (event.key.toLowerCase() === 'f') setImmersive(v => !v);
    if (event.key === 'ArrowRight') next(1);
    if (event.key === 'ArrowLeft') next(-1);
  }}>
    <div className="world-space" />
    <Globe places={markers} selected={selected} onSelect={select} label={text('拖动旋转地球，滚动缩放；也可以从城市列表选择。', 'Drag to rotate, scroll to zoom, or choose a city from the list.')} fallback={text('这台设备暂时无法绘制地球，仍可从城市列表观看直播。', 'The globe is unavailable on this device. You can still choose a live camera from the list.')} />
    <header className="world-heading"><h1>{text('此刻的世界', 'The world right now')}</h1><p>{text('城市、动物与旅途，和真实昼夜一起流转。', 'Cities, wildlife and journeys, under the real day and night.')}</p><small>{text(`${places.length} 个点位 · ${places.filter(p => p.videoId).length} 个直播入口`, `${places.length} places · ${places.filter(p => p.videoId).length} camera links`)}{loading ? text(' · 天气更新中', ' · Updating weather') : !Object.keys(weather).length ? text(' · 天气暂时未连接', ' · Weather offline') : ''}</small></header>
    <div className="world-directory"><nav className="world-groups world-glass" aria-label={text('现场分类', 'Camera categories')}>{groups.map(([id, zh, en]) => <button key={id} aria-pressed={group === id} onClick={() => { setGroup(id); setCategory('all'); setFilter('all'); setQuery(''); setSelected(null); setTour(false); }}>{text(zh, en)}<small>{places.filter(p => id === 'all' || p.group === id).length}</small></button>)}</nav>{(group === 'wildlife' || group === 'transport') && <select className="world-subcategory world-glass" aria-label={text('细分类型', 'Camera type')} value={category} onChange={e => { setCategory(e.target.value); setSelected(null); }}><option value="all">{text('全部类型', 'All types')}</option>{categoryOptions.map(c => <option key={c} value={c}>{categories[c]?.[english ? 1 : 0] || c}</option>)}</select>}</div>
    {list && !immersive && <aside className="world-list world-glass" aria-label={text('现场列表', 'Cameras')}><div className="world-list-top"><strong>{text('依当地时间', 'By local time')}</strong><button onClick={() => setList(false)} aria-label={text('收起现场列表', 'Hide cameras')}><X size={15} /></button></div><label className="world-search"><Search size={14} /><input aria-label={text('搜索地点或动物', 'Search places or animals')} placeholder={text('搜索地点或动物', 'Search places or animals')} value={query} onChange={event => setQuery(event.target.value)} /></label><div className="world-cities">{visible.map(p => <button key={p.id} className={selected?.id === p.id ? 'chosen' : ''} onClick={() => select(p)}><time>{localTime(p, now, weather[p.id])}</time><span className={`world-dot ${p.videoId && !health[p.id] ? '' : 'offline'}`} /><span>{english ? p.en : p.zh}</span>{favorites.includes(p.id) && <Heart size={12} />}</button>)}{!visible.length && <p className="world-empty">{text('暂时没有符合条件的现场，试试其他分类或筛选。', 'No cameras match. Try another category or filter.')}</p>}</div></aside>}
    {selected && <motion.aside key={panelVersion} className="world-camera world-glass" drag={!mobile} dragListener={false} dragControls={drag} dragConstraints={root} dragMomentum={false} role="region" aria-label={text(`${selected.zh}直播`, `${selected.en} live camera`)}>
      <div className="world-camera-title" onPointerDown={e => { if (!mobile && !(e.target as HTMLElement).closest('button')) drag.start(e); }}><div><h2>{english ? selected.en : selected.zh}</h2><p>{new Intl.DisplayNames([english ? 'en' : 'zh-CN'], { type: 'region' }).of(selected.country)} · {localTime(selected, now, weather[selected.id])}{weather[selected.id] && now - weather[selected.id].fetchedAt < 3600000 ? ` · ${Math.round(weather[selected.id].temperature)}°C` : ''}</p></div><button onClick={() => toggleFavorite(selected.id)} aria-label={text('收藏这个现场', 'Favorite camera')} aria-pressed={favorites.includes(selected.id)}><Heart size={17} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} /></button><button onClick={() => { setSelected(null); setTour(false); }} aria-label={text('关闭直播', 'Close camera')}><X size={18} /></button></div>
      <LivePlayer key={selected.id} place={selected} english={english} onNext={() => next(1)} />
      <div className="world-camera-actions"><button onClick={() => next(-1)}>← {text('上一站', 'Previous')}</button><button aria-pressed={tour} onClick={() => setTour(v => !v)}>{tour ? text('停止漫游', 'Stop tour') : text('自动漫游', 'Start tour')}</button><button onClick={() => next(1)}>{text('下一站', 'Next')} →</button><button onClick={() => setPanelVersion(v => v + 1)}>{text('重置位置', 'Reset panel')}</button></div>
    </motion.aside>}
    <div className="world-controls">
      <nav className="world-filters world-glass" aria-label={text('天气与时间筛选', 'Weather and time filters')}>{filters.map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}><span style={{ background: filterInfo[f][2] }} />{filterInfo[f][english ? 1 : 0]}<small>{pool.filter(p => matches(p, f, now, weather[p.id])).length}</small></button>)}</nav>
      <div className="world-bottom"><div className="world-focus world-glass">{!focus ? <><select aria-label={text('专注时长', 'Focus length')} value={minutes} onChange={e => setMinutes(+e.target.value)}>{[5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 0].map(m => <option key={m} value={m}>{m ? `${m} ${text('分钟', 'min')}` : text('陪读 · 不限时', 'Study along')}</option>)}</select><button onClick={() => { visited.current.clear(); if (selected) visited.current.add(english ? selected.en : selected.zh); setFocus({ started: Date.now(), duration: minutes, pausedAt: null, paused: 0 }); setSummary(null); }}><Play size={14} />{text('开始专注', 'Focus')}</button></> : <><output aria-label={text('专注计时', 'Focus timer')}>{String(Math.floor(timerValue / 60)).padStart(2, '0')}:{String(timerValue % 60).padStart(2, '0')}</output><button aria-label={focus.pausedAt ? text('继续专注', 'Resume focus') : text('暂停专注', 'Pause focus')} onClick={() => setFocus(f => !f ? null : f.pausedAt ? { ...f, paused: f.paused + Date.now() - f.pausedAt, pausedAt: null } : { ...f, pausedAt: Date.now() })}>{focus.pausedAt ? <Play size={16} /> : <Pause size={16} />}</button><button onClick={() => finishRef.current()} aria-label={text('结束专注', 'Finish focus')}><Square size={14} /></button></>}</div>
      <div className="world-toolbar world-glass"><button aria-label={text('现场列表', 'Cameras')} title={text('现场列表', 'Cameras')} aria-pressed={list} onClick={() => setList(v => !v)}><List size={18} /></button><button aria-label={text('只看有直播入口的现场', 'Only cameras with stream links')} title={text('只看有直播入口的现场', 'Only cameras with stream links')} aria-pressed={onlyLive} onClick={() => setOnlyLive(v => !v)}><span className="world-live-icon">◉</span></button><button aria-label={text('我的收藏', 'Favorites')} title={text('我的收藏', 'Favorites')} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(v => !v)}><Heart size={17} /></button><button aria-label={text('随机旅行', 'Surprise me')} title={text('随机旅行', 'Surprise me')} disabled={!visible.length} onClick={() => select(visible[Math.floor(Math.random() * visible.length)])}><Shuffle size={18} /></button><button aria-label={text('环境音混音台', 'Ambient mixer')} title={text('环境音混音台', 'Ambient mixer')} aria-pressed={mixer} onClick={() => setMixer(v => !v)}><Volume2 size={18} /></button><button aria-label={text('沉浸模式', 'Immersive mode')} title={text('沉浸模式', 'Immersive mode')} onClick={() => setImmersive(true)}><Maximize2 size={16} /></button><button aria-label={text('使用说明', 'Help')} title={text('使用说明', 'Help')} onClick={() => setHelp(true)}><HelpCircle size={17} /></button><select aria-label={text('地图语言', 'Map language')} value={language} onChange={e => setLanguage(e.target.value as 'zh' | 'en')}><option value="zh">简体中文</option><option value="en">English</option></select></div></div>
      <footer><span>{text('拖动地球 · 点击图钉 · F 沉浸', 'Drag the globe · Choose a pin · F to immerse')}</span><a href={assetUrl('maps/credits.txt')} target="_blank" rel="noopener noreferrer">{text('地球影像', 'Earth')}: Solar System Scope · CC BY 4.0</a><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">{text('天气', 'Weather')}: Open-Meteo <ExternalLink size={10} /></a></footer>
    </div>
    {immersive && <button className="world-exit world-glass" onClick={() => setImmersive(false)}><Minimize2 size={16} />{text('退出沉浸', 'Exit immersive')}</button>}
    <div className={mixer ? 'world-sound-panel world-glass' : 'world-sound-panel hidden'}><button className="world-overlay-close" onClick={() => setMixer(false)} aria-label={text('关闭混音台', 'Close mixer')}><X size={18} /></button><Ambience english={english} /></div>
    {(help || summary) && <div className="world-modal-backdrop" onClick={() => { setHelp(false); setSummary(null); }}><div className="world-help world-glass" role="dialog" aria-modal="true" aria-label={text('此刻的世界', 'The world right now')} onClick={e => e.stopPropagation()}><button autoFocus className="world-overlay-close" onClick={() => { setHelp(false); setSummary(null); }} aria-label={text('关闭说明', 'Close help')}><X size={20} /></button><small>THE WORLD RIGHT NOW</small><h2>{summary ? text('这一刻，留给自己。', 'A moment for yourself.') : text('找个地方，陪你一会儿。', 'Find a place to keep you company.')}</h2>{summary ? <p>{summary}</p> : <><p>{text('选择城市、动物或交通，拖动地球并点一枚图钉。动物还可以按种类筛选，交通包含机场、铁路与港口。', 'Choose cities, wildlife or transport, then spin the globe and tap a pin. Narrow wildlife by species or explore airports, railways and harbors.')}</p><p>{text('地球的昼夜按当前时间更新；白天、晨昏与夜间筛选使用相同的太阳位置。天气未连接时仍可浏览。室内现场不参与昼夜筛选。', 'Day and night follow the current solar position, shared with the daylight and twilight filters. Browsing works without weather; indoor cameras are excluded from daylight filters.')}</p><p>{text('收藏喜欢的现场，混合环境音，再给自己设一段专注时间。动物与班次不保证随时出现，当季看点也不等于实时目击。', 'Save cameras, mix ambient sounds and set a focus timer. Wildlife and passing vehicles are never guaranteed; seasonal highlights are not live sightings.')}</p><p>{text('直播来自 YouTube。网络暂时无法连接时，可以打开原直播或换个地方看看。', 'Live streams come from YouTube. If one cannot connect, try its original page or another place.')}</p><a href="https://meanwhile-cam.vercel.app/" target="_blank" rel="noopener noreferrer">{text('城市参考：Meanwhile ↗', 'Cities: Meanwhile ↗')}</a><br /><a href="https://animalia-live.vercel.app/" target="_blank" rel="noopener noreferrer">{text('动物参考：Animalia Live ↗', 'Animals: Animalia Live ↗')}</a><br /><a href="https://vehicula-live.vercel.app/" target="_blank" rel="noopener noreferrer">{text('交通参考：Vehicula Live ↗', 'Transport: Vehicula Live ↗')}</a></>}</div></div>}
  </section>;
}
