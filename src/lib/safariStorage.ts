import type { SafariBookmark } from '../data/aiBookmarks';

export const SAFARI_DIRECTORY_STATE_KEY = 'liu-os-safari-bookmarks-v2';
export const SAFARI_FAVORITES_KEY = 'liu-os-safari-favorites-v2';
export const SAFARI_HISTORY_KEY = 'liu-os-safari-history-v2';
export const SAFARI_CUSTOM_KEY = 'liu-os-safari-custom-v1';

const LEGACY_FAVORITE_KEYS = ['liu-os-safari-favorites-v1'];
const LEGACY_HISTORY_KEYS = ['liu-os-safari-history-v1', 'liu-os-safari-recent-v1'];

export interface SafariSavedLink {
  id: string;
  targetUrl: string;
  updatedAt: number;
  visits?: number;
}

const isSafeTarget = (value: string) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.toLowerCase() !== 'ai-bot.cn';
  } catch {
    return false;
  }
};

const readJson = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Safari history and favorites are optional when browser storage is full.
  }
};

const normalizeSavedLinks = (value: unknown, bookmarkMap: Map<string, SafariBookmark>, limit: number): SafariSavedLink[] => {
  if (!Array.isArray(value)) return [];
  const normalized = value.flatMap((entry): SafariSavedLink[] => {
    const id = typeof entry === 'string' ? entry : entry && typeof entry === 'object' && typeof entry.id === 'string' ? entry.id : '';
    const bookmark = bookmarkMap.get(id);
    if (!bookmark || bookmark.linkStatus !== 'valid' || !isSafeTarget(bookmark.targetUrl)) return [];
    const visits = typeof entry === 'object' && entry && typeof entry.visits === 'number' ? Math.max(1, Math.floor(entry.visits)) : 1;
    const updatedAt = typeof entry === 'object' && entry && typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now();
    return [{ id, targetUrl: bookmark.targetUrl, updatedAt, visits }];
  });
  return Array.from(new Map(normalized.map((entry) => [entry.id, entry])).values()).slice(0, limit);
};

const migrateLegacy = (keys: string[], bookmarkMap: Map<string, SafariBookmark>, limit: number) => {
  for (const key of keys) {
    const migrated = normalizeSavedLinks(readJson(key), bookmarkMap, limit);
    if (migrated.length) return migrated;
  }
  return [];
};

export const loadSafariLibrary = (bookmarks: SafariBookmark[]) => {
  const bookmarkMap = new Map(bookmarks.map((bookmark) => [bookmark.id, bookmark]));
  const storedFavorites = normalizeSavedLinks(readJson(SAFARI_FAVORITES_KEY), bookmarkMap, 200);
  const storedHistory = normalizeSavedLinks(readJson(SAFARI_HISTORY_KEY), bookmarkMap, 80);
  const userFavorites = storedFavorites.length ? storedFavorites : migrateLegacy(LEGACY_FAVORITE_KEYS, bookmarkMap, 200);
  const fixedFavorites = bookmarks.filter((bookmark) => bookmark.pinned && bookmark.linkStatus === 'valid' && isSafeTarget(bookmark.targetUrl)).map((bookmark): SafariSavedLink => ({ id: bookmark.id, targetUrl: bookmark.targetUrl, updatedAt: Date.now(), visits: 1 }));
  const favorites = Array.from(new Map([...fixedFavorites, ...userFavorites].map((entry) => [entry.id, entry])).values()).slice(0, 200);
  const history = storedHistory.length ? storedHistory : migrateLegacy(LEGACY_HISTORY_KEYS, bookmarkMap, 80);

  writeJson(SAFARI_DIRECTORY_STATE_KEY, { version: 2, migratedAt: Date.now() });
  writeJson(SAFARI_FAVORITES_KEY, favorites);
  writeJson(SAFARI_HISTORY_KEY, history);
  [...LEGACY_FAVORITE_KEYS, ...LEGACY_HISTORY_KEYS].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Old cache cleanup is best-effort.
    }
  });

  return { favorites, history };
};

export const saveSafariFavorites = (favorites: SafariSavedLink[]) => writeJson(SAFARI_FAVORITES_KEY, favorites.slice(0, 200));
export const saveSafariHistory = (history: SafariSavedLink[]) => writeJson(SAFARI_HISTORY_KEY, history.slice(0, 80));

export const loadCustomSafariBookmarks = () => {
  const value = readJson(SAFARI_CUSTOM_KEY);
  if (!Array.isArray(value)) return [] as SafariBookmark[];
  return value.flatMap((entry): SafariBookmark[] => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Partial<SafariBookmark>;
    if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.targetUrl !== 'string' || !isSafeTarget(item.targetUrl)) return [];
    return [{
      id: item.id,
      title: item.title.slice(0, 100),
      targetUrl: item.targetUrl,
      linkStatus: 'valid',
      embedStatus: item.embedStatus === 'blocked' ? 'blocked' : 'allowed',
      embedUrl: typeof item.embedUrl === 'string' ? item.embedUrl : undefined,
      descriptionZh: typeof item.descriptionZh === 'string' ? item.descriptionZh : '用户添加的网站',
      descriptionEn: typeof item.descriptionEn === 'string' ? item.descriptionEn : 'User-added website',
      categoryId: 'custom',
      icon: typeof item.icon === 'string' ? item.icon : undefined,
      custom: true,
    }];
  });
};

export const saveCustomSafariBookmarks = (bookmarks: SafariBookmark[]) => writeJson(SAFARI_CUSTOM_KEY, bookmarks.slice(0, 100));
