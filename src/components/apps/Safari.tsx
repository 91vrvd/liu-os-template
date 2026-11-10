import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Clock3, ExternalLink, Folder, Grid2X2, Lock, PanelLeft, Plus, RotateCw, Search, Share, Star, Trash2, X } from 'lucide-react';
import { aiBookmarks, bookmarkCategories, getProjectBookmarks, SafariBookmark, ownSiteIcons } from '../../data/aiBookmarks';
import { aiBotCatalog } from '../../data/aiBotCatalog';
import { useI18n } from '../../i18n';
import { loadCustomSafariBookmarks, loadSafariLibrary, SafariSavedLink, saveCustomSafariBookmarks, saveSafariFavorites, saveSafariHistory } from '../../lib/safariStorage';
import { useSiteContent } from '../../content/siteContent';

type DirectoryFilter = 'all' | 'favorites' | 'recent';
type SafariPage = {
  kind: 'start' | 'directory' | 'external';
  url: string;
  title: string;
  bookmarkId?: string;
};
type SafariTab = {
  id: string;
  stack: SafariPage[];
  index: number;
};

const startPage = (): SafariPage => ({ kind: 'start', url: 'liu://start', title: 'Start Page' });
const createTab = (): SafariTab => ({ id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, stack: [startPage()], index: 0 });
const safeOpen = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
const MAX_TABS = 8;

const isPrivateHostname = (hostname: string) => {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (value === 'localhost' || value === '::1' || value.endsWith('.local')) return true;
  if (/^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value)) return true;
  const match = value.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
};

const normalizeBrowserUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'desktop.start' || trimmed === 'liu://start') return { page: startPage() };
  const looksLikeUrl = /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|(?:[a-z\d-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#].*)?$/i.test(trimmed);
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) && !looksLikeUrl) {
    return { page: { kind: 'external' as const, url: `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`, title: `搜索：${trimmed}` } };
  }
  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || isPrivateHostname(url.hostname)) return { error: true };
    url.username = '';
    url.password = '';
    return { page: { kind: 'external' as const, url: url.href, title: url.hostname } };
  } catch {
    return { error: true };
  }
};

const embedPolicy = (url: URL) => {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const youtubeId = hostname === 'youtu.be'
    ? url.pathname.split('/').filter(Boolean)[0]
    : hostname.endsWith('youtube.com') ? url.searchParams.get('v') : null;
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return { embedStatus: 'allowed' as const, embedUrl: `https://www.youtube.com/embed/${youtubeId}` };
  }
  const blockedHosts = ['youtube.com', 'google.com', 'gmail.com', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'chatgpt.com', 'claude.ai'];
  const blocked = blockedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  return { embedStatus: blocked ? 'blocked' as const : 'allowed' as const };
};

const createAdHocBookmark = (page: SafariPage): SafariBookmark => {
  const url = new URL(page.url);
  const policy = embedPolicy(url);
  return {
    id: `custom-${url.href}`,
    title: page.title || url.hostname,
    targetUrl: url.href,
    linkStatus: 'valid',
    embedStatus: policy.embedStatus,
    embedUrl: policy.embedUrl,
    descriptionZh: '用户输入的网址',
    descriptionEn: 'User-entered website',
    categoryId: 'custom',
    icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`,
  };
};

const BookmarkIcon: React.FC<{ bookmark: SafariBookmark; large?: boolean }> = ({ bookmark, large = false }) => {
  const [failed, setFailed] = useState(false);
  return <span className={`${large ? 'h-14 w-14 rounded-[12px]' : 'h-9 w-9 rounded-[9px]'} flex shrink-0 items-center justify-center overflow-hidden bg-[#e9edf4] text-base font-bold text-[#356aa0] shadow-sm dark:bg-white/10 dark:text-blue-200`}>
    {!failed && bookmark.icon ? <img src={bookmark.icon} alt="" className="h-full w-full bg-white object-contain p-2" onError={() => setFailed(true)} /> : bookmark.title.slice(0, 1).toUpperCase()}
  </span>;
};

const ExternalPage: React.FC<{ bookmark: SafariBookmark; language: 'zh' | 'en'; openLabel: string; blockedTitle: string; blockedText: string; failureLabel: string }> = ({ bookmark, language, openLabel, blockedTitle, blockedText, failureLabel }) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const canEmbed = bookmark.embedStatus === 'allowed';
  useEffect(() => {
    setState(canEmbed ? 'loading' : 'error');
    if (!canEmbed) return undefined;
    const timer = window.setTimeout(() => setState((current) => current === 'loading' ? 'error' : current), 6500);
    return () => window.clearTimeout(timer);
  }, [bookmark.id, canEmbed]);

  return <div className="relative flex h-full min-h-0 flex-col bg-white dark:bg-[#1c1c1e]">
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-[#f5f5f7] px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-[#262628] dark:text-slate-300">
      <BookmarkIcon bookmark={bookmark} />
      <span className="min-w-0 flex-1"><strong className="block truncate text-slate-700 dark:text-slate-100">{bookmark.title}</strong><span className="block truncate">{language === 'zh' ? bookmark.descriptionZh : bookmark.descriptionEn}</span></span>
      {canEmbed && state !== 'error' && <button type="button" onClick={() => setState('error')} className="hidden shrink-0 text-[11px] text-slate-400 hover:text-slate-600 sm:block dark:hover:text-slate-200">{failureLabel}</button>}
      <button type="button" onClick={() => safeOpen(bookmark.targetUrl)} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1.5 font-medium text-white hover:bg-blue-600"><ExternalLink size={13} />{openLabel}</button>
    </div>
    {canEmbed && <iframe
        key={bookmark.embedUrl ?? bookmark.targetUrl}
        src={bookmark.embedUrl ?? bookmark.targetUrl}
        title={bookmark.title}
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        allow="camera; microphone; autoplay; fullscreen"
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
        className="min-h-0 flex-1 border-0 bg-white"
      />}
    {!canEmbed && <div className="min-h-0 flex-1" />}
    {state === 'loading' && <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center"><span className="rounded-md bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow dark:bg-black/70 dark:text-slate-300">{language === 'zh' ? '正在连接网站…' : 'Connecting…'}</span></div>}
    {state === 'error' && <div className="absolute inset-0 top-14 flex items-center justify-center bg-[#f5f5f7]/95 p-6 dark:bg-[#1c1c1e]/95"><div className="max-w-md text-center"><AlertTriangle className="mx-auto mb-3 text-amber-500" size={34} /><h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{blockedTitle}</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{blockedText}</p><button type="button" onClick={() => safeOpen(bookmark.targetUrl)} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"><ExternalLink size={15} />{openLabel}</button></div></div>}
  </div>;
};

export const SafariApp: React.FC = () => {
  const { t, language } = useI18n();
  const { content } = useSiteContent();
  const projectBookmarks = useMemo(() => getProjectBookmarks(language, content.projects), [content.projects, language]);
  const managedBookmarks = useMemo<SafariBookmark[]>(() => content.safariBookmarks.map((bookmark) => {
    let policy: ReturnType<typeof embedPolicy> | undefined;
    try {
      if (bookmark.targetUrl) policy = embedPolicy(new URL(bookmark.targetUrl));
    } catch {
      policy = undefined;
    }
    return {
      id: bookmark.id,
      title: bookmark.title[language],
      targetUrl: bookmark.targetUrl,
      linkStatus: bookmark.targetUrl ? 'valid' : 'unresolved',
      embedStatus: policy?.embedStatus ?? 'unknown',
      embedUrl: policy?.embedUrl,
      descriptionZh: bookmark.description.zh,
      descriptionEn: bookmark.description.en,
      categoryId: 'projects',
      subcategoryId: 'project-sites',
      // Prefer the bundled real icon over a wide share image set in the admin panel.
      icon: ownSiteIcons[bookmark.id] ?? bookmark.icon,
      tags: [bookmark.category.zh, bookmark.category.en],
      pinned: bookmark.pinned,
    };
  }), [content.safariBookmarks, language]);
  const [customBookmarks, setCustomBookmarks] = useState<SafariBookmark[]>(() => loadCustomSafariBookmarks());
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [customError, setCustomError] = useState(false);
  const allBookmarks = useMemo(() => {
    const values = [...projectBookmarks, ...managedBookmarks, ...aiBotCatalog, ...aiBookmarks, ...customBookmarks];
    return Array.from(new Map(values.map((bookmark) => [bookmark.targetUrl || bookmark.id, bookmark])).values());
  }, [customBookmarks, managedBookmarks, projectBookmarks]);
  const bookmarkMap = useMemo(() => new Map(allBookmarks.map((bookmark) => [bookmark.id, bookmark])), [allBookmarks]);
  const [tabs, setTabs] = useState<SafariTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [favorites, setFavorites] = useState<SafariSavedLink[]>([]);
  const [history, setHistory] = useState<SafariSavedLink[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [addressInput, setAddressInput] = useState('desktop.start');
  const [addressError, setAddressError] = useState(false);

  useEffect(() => {
    const library = loadSafariLibrary(allBookmarks);
    setFavorites(library.favorites);
    setHistory(library.history);
  }, [allBookmarks]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 180);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activePage = activeTab.stack[activeTab.index] ?? startPage();
  const activeBookmark = activePage.bookmarkId ? bookmarkMap.get(activePage.bookmarkId) : undefined;
  const externalBookmark = activePage.kind === 'external' ? activeBookmark ?? createAdHocBookmark(activePage) : undefined;
  const favoriteIds = useMemo(() => new Set(favorites.map((entry) => entry.id)), [favorites]);
  const recentIds = useMemo(() => new Set(history.map((entry) => entry.id)), [history]);
  const currentCategory = bookmarkCategories.find((category) => category.id === selectedCategory);

  useEffect(() => {
    setAddressInput(activePage.kind === 'start' ? 'desktop.start' : activePage.url);
    setAddressError(false);
  }, [activePage.kind, activePage.url]);

  const navigate = (page: SafariPage) => {
    setTabs((current) => current.map((tab) => tab.id === activeTabId ? { ...tab, stack: [...tab.stack.slice(0, tab.index + 1), page], index: tab.index + 1 } : tab));
  };

  const goHistory = (delta: number) => {
    setTabs((current) => current.map((tab) => tab.id === activeTabId ? { ...tab, index: Math.max(0, Math.min(tab.stack.length - 1, tab.index + delta)) } : tab));
  };

  const addTab = () => {
    if (tabs.length >= MAX_TABS) return;
    const tab = createTab();
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
  };

  const submitAddress = (event: React.FormEvent) => {
    event.preventDefault();
    const result = normalizeBrowserUrl(addressInput);
    if (!result.page) {
      setAddressError(true);
      return;
    }
    navigate(result.page);
    setAddressError(false);
    setSidebarOpen(false);
  };

  const closeTab = (id: string) => {
    setTabs((current) => {
      if (current.length === 1) return [{ ...current[0], stack: [startPage()], index: 0 }];
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      if (id === activeTabId) setActiveTabId(next[Math.max(0, index - 1)]?.id ?? next[0].id);
      return next;
    });
  };

  const recordVisit = (bookmark: SafariBookmark) => {
    if (bookmark.linkStatus !== 'valid' || !bookmark.targetUrl) return;
    const existing = history.find((entry) => entry.id === bookmark.id);
    const next = [{ id: bookmark.id, targetUrl: bookmark.targetUrl, updatedAt: Date.now(), visits: (existing?.visits ?? 0) + 1 }, ...history.filter((entry) => entry.id !== bookmark.id)].slice(0, 80);
    setHistory(next);
    saveSafariHistory(next);
  };

  const openBookmark = (bookmark: SafariBookmark) => {
    if (bookmark.linkStatus !== 'valid' || !bookmark.targetUrl) return;
    recordVisit(bookmark);
    navigate({ kind: 'external', url: bookmark.targetUrl, title: bookmark.title, bookmarkId: bookmark.id });
    setSidebarOpen(false);
  };

  const toggleFavorite = (bookmark: SafariBookmark) => {
    if (bookmark.linkStatus !== 'valid' || !bookmark.targetUrl) return;
    if (bookmark.pinned) return;
    const next = favoriteIds.has(bookmark.id)
      ? favorites.filter((entry) => entry.id !== bookmark.id)
      : [{ id: bookmark.id, targetUrl: bookmark.targetUrl, updatedAt: Date.now(), visits: 1 }, ...favorites].slice(0, 200);
    setFavorites(next);
    saveSafariFavorites(next);
  };

  const addCustomSite = (event: React.FormEvent) => {
    event.preventDefault();
    const name = customName.trim();
    const result = normalizeBrowserUrl(customUrl);
    if (!name || !result.page || result.page.kind !== 'external' || result.page.url.includes('www.bing.com/search?q=')) {
      setCustomError(true);
      return;
    }
    const bookmark = createAdHocBookmark(result.page);
    const next: SafariBookmark = { ...bookmark, id: `custom-${Date.now()}`, title: name, descriptionZh: '用户添加的网站', descriptionEn: 'User-added website', custom: true };
    const nextBookmarks = [next, ...customBookmarks.filter((item) => item.targetUrl !== next.targetUrl)].slice(0, 100);
    setCustomBookmarks(nextBookmarks);
    saveCustomSafariBookmarks(nextBookmarks);
    setCustomName('');
    setCustomUrl('');
    setCustomError(false);
    setCustomFormOpen(false);
  };

  const deleteCustomSite = (bookmark: SafariBookmark) => {
    const nextBookmarks = customBookmarks.filter((item) => item.id !== bookmark.id);
    setCustomBookmarks(nextBookmarks);
    saveCustomSafariBookmarks(nextBookmarks);
    const nextFavorites = favorites.filter((item) => item.id !== bookmark.id);
    const nextHistory = history.filter((item) => item.id !== bookmark.id);
    setFavorites(nextFavorites);
    setHistory(nextHistory);
    saveSafariFavorites(nextFavorites);
    saveSafariHistory(nextHistory);
  };

  const showDirectory = (filter: DirectoryFilter = 'all', category = 'all') => {
    setDirectoryFilter(filter);
    setSelectedCategory(category);
    setSelectedSubcategory('all');
    navigate({ kind: 'directory', url: 'liu://ai-directory', title: t('safari.allTools') });
    setSidebarOpen(false);
  };

  const filteredBookmarks = useMemo(() => allBookmarks.filter((bookmark) => {
    const matchesCategory = selectedCategory === 'all' || bookmark.categoryId === selectedCategory;
    const matchesSubcategory = selectedSubcategory === 'all' || bookmark.subcategoryId === selectedSubcategory;
    const matchesFilter = directoryFilter === 'all' || (directoryFilter === 'favorites' ? favoriteIds.has(bookmark.id) : recentIds.has(bookmark.id));
    const haystack = `${bookmark.title} ${bookmark.descriptionZh} ${bookmark.descriptionEn} ${(bookmark.tags ?? []).join(' ')}`.toLowerCase();
    return matchesCategory && matchesSubcategory && matchesFilter && (!searchQuery || haystack.includes(searchQuery));
  }), [allBookmarks, directoryFilter, favoriteIds, recentIds, searchQuery, selectedCategory, selectedSubcategory]);

  const favoriteBookmarks = favorites.map((entry) => bookmarkMap.get(entry.id)).filter((bookmark): bookmark is SafariBookmark => Boolean(bookmark));
  const recentBookmarks = history.map((entry) => bookmarkMap.get(entry.id)).filter((bookmark): bookmark is SafariBookmark => Boolean(bookmark));
  const frequentBookmarks = [...history].sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0) || b.updatedAt - a.updatedAt).map((entry) => bookmarkMap.get(entry.id)).filter((bookmark): bookmark is SafariBookmark => Boolean(bookmark)).slice(0, 8);

  const ToolCard: React.FC<{ bookmark: SafariBookmark; compact?: boolean }> = ({ bookmark, compact = false }) => {
    const unavailable = bookmark.linkStatus !== 'valid' || !bookmark.targetUrl;
    const category = bookmarkCategories.find((item) => item.id === bookmark.categoryId);
    return <article className={`group relative flex border border-slate-200/80 bg-white/75 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-blue-400/50 ${compact ? 'items-center gap-3 rounded-lg p-3' : 'flex-col rounded-lg p-4'}`}>
      <button type="button" disabled={unavailable} onClick={() => openBookmark(bookmark)} className={`flex min-w-0 text-left disabled:cursor-not-allowed ${compact ? 'flex-1 items-center gap-3' : 'w-full flex-col items-start'}`}>
        <BookmarkIcon bookmark={bookmark} large={!compact} />
        <span className={`${compact ? 'min-w-0 flex-1' : 'mt-3 w-full'}`}>
          <span className="flex items-center gap-1"><strong className="block truncate text-sm text-slate-800 dark:text-slate-100">{bookmark.title}</strong>{!unavailable && <ExternalLink size={11} className="shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />}</span>
          <span className={`${compact ? 'line-clamp-1' : 'line-clamp-2'} mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400`}>{unavailable ? t('safari.linkUnavailable') : language === 'zh' ? bookmark.descriptionZh : bookmark.descriptionEn}</span>
          {!compact && category && <span className="mt-3 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-300">{language === 'zh' ? category.nameZh : category.nameEn}</span>}
        </span>
      </button>
      {!unavailable && <button type="button" disabled={bookmark.pinned} onClick={() => toggleFavorite(bookmark)} aria-label={bookmark.pinned ? t('safari.pinnedFavorite') : favoriteIds.has(bookmark.id) ? t('safari.unfavorite') : t('safari.favorite')} title={bookmark.pinned ? t('safari.pinnedFavorite') : favoriteIds.has(bookmark.id) ? t('safari.unfavorite') : t('safari.favorite')} className={`${compact ? '' : 'absolute right-3 top-3'} shrink-0 rounded-md p-1.5 text-amber-500 hover:bg-amber-50 disabled:cursor-default dark:hover:bg-amber-400/10`}><Star size={14} fill={bookmark.pinned || favoriteIds.has(bookmark.id) ? 'currentColor' : 'none'} /></button>}
      {bookmark.custom && <button type="button" onClick={() => deleteCustomSite(bookmark)} aria-label={t('safari.deleteCustomSite')} title={t('safari.deleteCustomSite')} className="absolute bottom-3 right-3 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-400/10"><Trash2 size={14} /></button>}
    </article>;
  };

  const StartPage = () => <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
    <section><div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-slate-700 dark:text-slate-100">{t('safari.favorites')}</h1><button type="button" onClick={() => showDirectory('favorites')} className="text-xs text-blue-600 hover:underline dark:text-blue-300">{t('safari.allTools')}</button></div>
      {favoriteBookmarks.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{favoriteBookmarks.slice(0, 8).map((bookmark) => <ToolCard key={bookmark.id} bookmark={bookmark} />)}</div> : <button type="button" onClick={() => showDirectory()} className="mt-4 flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 dark:border-white/15">{t('safari.favoritesEmpty')}</button>}
    </section>
    <section className="mt-9 border-t border-slate-200 pt-6 dark:border-white/10"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('safari.customSites')}</h2><button type="button" onClick={() => setCustomFormOpen((value) => !value)} className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600">{customFormOpen ? t('safari.cancelAddSite') : t('safari.addSite')}</button></div>
      {customFormOpen && <form onSubmit={addCustomSite} className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-[1fr_2fr_auto]"><input value={customName} onChange={(event) => { setCustomName(event.target.value); setCustomError(false); }} placeholder={t('safari.siteName')} aria-label={t('safari.siteName')} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-black/20" /><input value={customUrl} onChange={(event) => { setCustomUrl(event.target.value); setCustomError(false); }} placeholder={t('safari.siteUrl')} aria-label={t('safari.siteUrl')} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-black/20" /><button type="submit" className="rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600">{t('safari.saveSite')}</button>{customError && <p className="text-xs text-red-500 sm:col-span-3">{t('safari.siteInvalid')}</p>}</form>}
      {customBookmarks.length ? <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{customBookmarks.map((bookmark) => <ToolCard key={bookmark.id} bookmark={bookmark} compact />)}</div> : <p className="mt-2 text-xs text-slate-400">{t('safari.customSitesEmpty')}</p>}
    </section>
    {frequentBookmarks.length > 0 && <section className="mt-9 border-t border-slate-200 pt-6 dark:border-white/10"><h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{t('safari.frequentlyVisited')}</h2><div className="grid gap-2 sm:grid-cols-2">{frequentBookmarks.slice(0, 4).map((bookmark) => <ToolCard key={bookmark.id} bookmark={bookmark} compact />)}</div></section>}
    {recentBookmarks.length > 0 && <section className="mt-9 border-t border-slate-200 pt-6 dark:border-white/10"><h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{t('safari.recentlyVisited')}</h2><div className="grid gap-2 sm:grid-cols-2">{recentBookmarks.slice(0, 6).map((bookmark) => <ToolCard key={bookmark.id} bookmark={bookmark} compact />)}</div></section>}
    <section className="mt-9 border-t border-slate-200 pt-6 dark:border-white/10"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('safari.categories')}</h2><span className="text-[11px] text-slate-400">{allBookmarks.length} {t('safari.bookmarkCount')}</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{bookmarkCategories.map((category) => <button key={category.id} type="button" onClick={() => showDirectory('all', category.id)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-3 text-left text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-blue-400/10"><Folder size={16} className="text-blue-500" /><span className="truncate">{language === 'zh' ? category.nameZh : category.nameEn}</span></button>)}</div></section>
  </div>;

  const DirectoryPage = () => <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{directoryFilter === 'favorites' ? t('safari.favorites') : directoryFilter === 'recent' ? t('safari.recentlyVisited') : currentCategory ? (language === 'zh' ? currentCategory.nameZh : currentCategory.nameEn) : t('safari.allTools')}</h1><p className="mt-1 text-xs text-slate-400">{filteredBookmarks.length} {t('safari.bookmarkCount')}</p></div><label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-400 shadow-sm dark:border-white/10 dark:bg-white/5 sm:w-64"><Search size={14} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('safari.searchPlaceholder')} className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100" /></label></div>
    <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">{(['all', 'favorites', 'recent'] as const).map((filter) => <button key={filter} type="button" onClick={() => setDirectoryFilter(filter)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${directoryFilter === filter ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>{filter === 'all' ? t('safari.allTools') : filter === 'favorites' ? t('safari.favorites') : t('safari.recentlyVisited')}</button>)}</div>
    <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => { setSelectedCategory('all'); setSelectedSubcategory('all'); }} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs ${selectedCategory === 'all' ? 'bg-slate-700 text-white dark:bg-white dark:text-black' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>{t('safari.allTools')}</button>{bookmarkCategories.map((category) => <button key={category.id} type="button" onClick={() => { setSelectedCategory(category.id); setSelectedSubcategory('all'); }} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs ${selectedCategory === category.id ? 'bg-slate-700 text-white dark:bg-white dark:text-black' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>{language === 'zh' ? category.nameZh : category.nameEn}</button>)}</div>
    {currentCategory?.subcategories.length ? <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setSelectedSubcategory('all')} className={`whitespace-nowrap rounded px-2 py-1 text-[11px] ${selectedSubcategory === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200' : 'text-slate-500'}`}>{t('safari.allCategories')}</button>{currentCategory.subcategories.map((subcategory) => <button key={subcategory.id} type="button" onClick={() => setSelectedSubcategory(subcategory.id)} className={`whitespace-nowrap rounded px-2 py-1 text-[11px] ${selectedSubcategory === subcategory.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200' : 'text-slate-500'}`}>{language === 'zh' ? subcategory.nameZh : subcategory.nameEn}</button>)}</div> : null}
    {filteredBookmarks.length ? <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredBookmarks.map((bookmark) => <ToolCard key={bookmark.id} bookmark={bookmark} />)}</div> : <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 dark:border-white/15">{t('safari.noResults')}</div>}
  </div>;

  return <div onPointerDown={(event) => event.stopPropagation()} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#fbfbfd] text-slate-800 dark:bg-[#1c1c1e] dark:text-slate-200">
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 bg-[#eceef2]/95 px-2 dark:border-black/30 dark:bg-[#2c2c2e] sm:px-3">
      <button type="button" aria-label={t('safari.sidebar')} title={t('safari.sidebar')} onClick={() => setSidebarOpen((value) => !value)} className="rounded-md p-1.5 text-slate-500 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"><PanelLeft size={16} /></button>
      <button type="button" aria-label={t('safari.back')} disabled={activeTab.index <= 0} onClick={() => goHistory(-1)} className="rounded-md p-1.5 text-slate-500 hover:bg-black/5 disabled:opacity-25 dark:text-slate-300 dark:hover:bg-white/10"><ArrowLeft size={16} /></button>
      <button type="button" aria-label={t('safari.forward')} disabled={activeTab.index >= activeTab.stack.length - 1} onClick={() => goHistory(1)} className="rounded-md p-1.5 text-slate-500 hover:bg-black/5 disabled:opacity-25 dark:text-slate-300 dark:hover:bg-white/10"><ArrowRight size={16} /></button>
      <form onSubmit={submitAddress} className={`mx-auto flex h-8 min-w-0 max-w-2xl flex-1 items-center rounded-lg border bg-white/85 px-2 shadow-sm dark:bg-[#1f1f21] ${addressError ? 'border-red-400 dark:border-red-400' : 'border-slate-300/80 dark:border-black/40'}`}><Lock size={11} className="mr-2 shrink-0 text-slate-400" /><input value={addressInput} onChange={(event) => { setAddressInput(event.target.value); setAddressError(false); }} onFocus={(event) => event.currentTarget.select()} aria-label={t('safari.addressBar')} aria-invalid={addressError} placeholder={t('safari.addressPlaceholder')} className="min-w-0 flex-1 bg-transparent text-center text-xs font-medium text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-300" /><button type="submit" aria-label={t('safari.go')} title={t('safari.go')} className="ml-1 shrink-0 rounded p-0.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-400/10"><ArrowRight size={13} /></button><button type="button" aria-label={t('safari.refresh')} onClick={() => { setRefreshing(true); window.setTimeout(() => setRefreshing(false), 600); }} className="ml-1 shrink-0 text-slate-400"><RotateCw size={13} className={refreshing ? 'animate-spin' : ''} /></button></form>
      <button type="button" aria-label={t('safari.openInNewTab')} disabled={activePage.kind !== 'external'} onClick={() => activePage.kind === 'external' && safeOpen(activePage.url)} className="rounded-md p-1.5 text-slate-500 hover:bg-black/5 disabled:opacity-25 dark:text-slate-300 dark:hover:bg-white/10"><Share size={15} /></button>
      <button type="button" aria-label={t('safari.allTools')} onClick={() => showDirectory()} className="hidden rounded-md p-1.5 text-slate-500 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10 sm:block"><Grid2X2 size={15} /></button>
      <button type="button" aria-label={t('safari.newTab')} disabled={tabs.length >= MAX_TABS} onClick={addTab} className="rounded-md p-1.5 text-slate-500 hover:bg-black/5 disabled:opacity-25 dark:text-slate-300 dark:hover:bg-white/10"><Plus size={16} /></button>
    </div>
    <div className="no-scrollbar flex h-9 shrink-0 items-end gap-1 overflow-x-auto border-b border-slate-200 bg-[#e6e8ec] px-2 pt-1 dark:border-black/30 dark:bg-[#252527]">{tabs.map((tab) => { const page = tab.stack[tab.index] ?? startPage(); const selected = tab.id === activeTabId; return <button key={tab.id} type="button" onClick={() => setActiveTabId(tab.id)} className={`group flex h-8 min-w-28 max-w-52 items-center gap-2 rounded-t-lg px-3 text-xs ${selected ? 'bg-[#fbfbfd] text-slate-700 shadow-sm dark:bg-[#1c1c1e] dark:text-slate-100' : 'text-slate-500 hover:bg-white/40 dark:text-slate-400 dark:hover:bg-white/5'}`}><span className="min-w-0 flex-1 truncate">{page.kind === 'start' ? t('safari.startPage') : page.kind === 'directory' ? t('safari.allTools') : page.title}</span><span role="button" tabIndex={0} aria-label={t('safari.closeTab')} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); closeTab(tab.id); } }} className="rounded p-0.5 opacity-50 hover:bg-black/10 group-hover:opacity-100 dark:hover:bg-white/10"><X size={11} /></span></button>; })}</div>
    <div className="relative flex min-h-0 flex-1">
      {sidebarOpen && <><button type="button" aria-label={t('safari.closeSidebar')} onClick={() => setSidebarOpen(false)} className="absolute inset-0 z-20 bg-black/20 md:hidden" /><aside className="absolute inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-[#f2f3f6]/95 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#252527]/95 md:relative md:z-0 md:shadow-none"><nav className="space-y-1 text-sm"><button type="button" onClick={() => { navigate(startPage()); setSidebarOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"><BookOpen size={15} />{t('safari.startPage')}</button><button type="button" onClick={() => showDirectory('favorites')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"><Star size={15} />{t('safari.favorites')}<span className="ml-auto text-xs text-slate-400">{favorites.length}</span></button><button type="button" onClick={() => showDirectory('recent')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"><Clock3 size={15} />{t('safari.recentlyVisited')}</button><button type="button" onClick={() => showDirectory()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"><Grid2X2 size={15} />{t('safari.allTools')}</button></nav><div className="my-3 h-px bg-slate-200 dark:bg-white/10" /><div className="min-h-0 flex-1 overflow-y-auto"><h3 className="px-3 pb-1 text-[11px] font-semibold uppercase text-slate-400">{t('safari.categories')}</h3>{bookmarkCategories.map((category) => <button key={category.id} type="button" onClick={() => showDirectory('all', category.id)} className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"><Folder size={13} className="text-blue-500" /><span className="truncate">{language === 'zh' ? category.nameZh : category.nameEn}</span></button>)}</div></aside></>}
      <main className="min-w-0 flex-1 overflow-y-auto">{activePage.kind === 'start' ? <StartPage /> : activePage.kind === 'directory' ? <DirectoryPage /> : externalBookmark ? <ExternalPage bookmark={externalBookmark} language={language} openLabel={t('safari.openInSystemBrowser')} blockedTitle={t('safari.embedBlockedTitle')} blockedText={t('safari.embedBlockedText')} failureLabel={t('safari.embedFailedAction')} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('safari.linkUnavailable')}</div>}</main>
    </div>
  </div>;
};
