import type { MediaPlatform, MediaTrack } from '../store/useStore';

/**
 * Music sources for Liu OS.
 *
 * - Meting API (https://github.com/metowolf/Meting-API) resolves NetEase / QQ / KuGou links and
 *   keyword searches into public tracks. The URLs it returns redirect to the platform's own audio
 *   file; tracks that need a membership or are region locked simply fail to load and are skipped.
 *   Nothing here bypasses payment, login or DRM.
 * - Spotify and Apple Music only expose official embed players.
 * - Direct audio links (mp3/m4a/...) play in the site's own player.
 */

export type MetingServer = 'netease' | 'tencent' | 'kugou' | 'kuwo' | 'baidu';
export type MetingType = 'song' | 'playlist' | 'album' | 'artist' | 'search';

export interface MusicSource {
  id: string;
  name: string;
  baseUrl: string;
  builtIn?: boolean;
}

/** No source ships by default: visitors add the Meting API endpoints they want to use. */
export const BUILT_IN_MUSIC_SOURCES: MusicSource[] = [];

export const METING_SERVERS: { id: MetingServer; zh: string; en: string; searchable: boolean }[] = [
  { id: 'netease', zh: '网易云', en: 'NetEase', searchable: true },
  { id: 'tencent', zh: 'QQ 音乐', en: 'QQ Music', searchable: true },
  { id: 'kugou', zh: '酷狗', en: 'KuGou', searchable: true },
  { id: 'kuwo', zh: '酷我', en: 'Kuwo', searchable: true },
  { id: 'baidu', zh: '千千', en: 'Qianqian', searchable: true },
];

export const platformLabel = (platform: MediaPlatform, language: 'zh' | 'en' = 'zh') => {
  const labels: Record<MediaPlatform, { zh: string; en: string }> = {
    direct: { zh: '音频链接', en: 'Audio link' },
    netease: { zh: '网易云', en: 'NetEase' },
    tencent: { zh: 'QQ 音乐', en: 'QQ Music' },
    kugou: { zh: '酷狗', en: 'KuGou' },
    kuwo: { zh: '酷我', en: 'Kuwo' },
    baidu: { zh: '千千', en: 'Qianqian' },
    spotify: { zh: 'Spotify', en: 'Spotify' },
    apple: { zh: 'Apple Music', en: 'Apple Music' },
  };
  return labels[platform]?.[language] ?? platform;
};

export const makeTrackId = () => `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeSourceUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.hash = '';
    // Accept both ".../api" and ".../api?server=..." pasted from a browser.
    url.search = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
};

const toUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
};

export type ParsedLink =
  | { kind: 'meting'; server: MetingServer; type: Exclude<MetingType, 'search'>; id: string; url: string }
  | { kind: 'embed'; track: MediaTrack }
  | { kind: 'direct'; track: MediaTrack }
  | { kind: 'short'; url: string; platform: MediaPlatform }
  | { kind: 'unknown'; value: string };

const hashParams = (url: URL) => new URLSearchParams(url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : url.hash.replace(/^#/, ''));

const parseNetEase = (url: URL): ParsedLink | null => {
  const route = `${url.pathname}${url.hash}`.toLowerCase();
  const id = url.searchParams.get('id')
    ?? hashParams(url).get('id')
    ?? route.match(/(?:song|playlist|album|artist)\/(\d+)/)?.[1];
  if (!id || !/^\d+$/.test(id)) return null;
  const outchainType = url.searchParams.get('type');
  let type: Exclude<MetingType, 'search'> = 'song';
  if (route.includes('playlist') || outchainType === '0') type = 'playlist';
  else if (route.includes('album') || outchainType === '1') type = 'album';
  else if (route.includes('artist')) type = 'artist';
  return { kind: 'meting', server: 'netease', type, id, url: `https://music.163.com/${type}?id=${id}` };
};

const parseTencent = (url: URL): ParsedLink | null => {
  const path = url.pathname;
  const songmid = url.searchParams.get('songmid') ?? path.match(/songDetail\/([A-Za-z0-9]+)/i)?.[1] ?? path.match(/\/song\/([A-Za-z0-9]+)\.html/i)?.[1];
  if (songmid) return { kind: 'meting', server: 'tencent', type: 'song', id: songmid, url: `https://y.qq.com/n/ryqq/songDetail/${songmid}` };
  const playlist = url.searchParams.get('id') && /playlist|taoge/i.test(path) ? url.searchParams.get('id') : path.match(/playlist\/(\d+)/i)?.[1];
  if (playlist) return { kind: 'meting', server: 'tencent', type: 'playlist', id: playlist, url: `https://y.qq.com/n/ryqq/playlist/${playlist}` };
  const album = url.searchParams.get('albummid') ?? path.match(/albumDetail\/([A-Za-z0-9]+)/i)?.[1];
  if (album) return { kind: 'meting', server: 'tencent', type: 'album', id: album, url: `https://y.qq.com/n/ryqq/albumDetail/${album}` };
  return null;
};

const parseKugou = (url: URL): ParsedLink | null => {
  const hash = url.searchParams.get('hash') ?? hashParams(url).get('hash') ?? url.hash.match(/hash=([A-Fa-f0-9]{32})/)?.[1];
  if (hash && /^[A-Fa-f0-9]{32}$/.test(hash)) return { kind: 'meting', server: 'kugou', type: 'song', id: hash.toLowerCase(), url: url.href };
  const special = url.pathname.match(/special\/single\/(\d+)/i)?.[1] ?? url.pathname.match(/songlist\/gcid_([A-Za-z0-9]+)/i)?.[1];
  if (special) return { kind: 'meting', server: 'kugou', type: 'playlist', id: special, url: url.href };
  return null;
};

const parseKuwo = (url: URL): ParsedLink | null => {
  const song = url.pathname.match(/play_detail\/(\d+)/i)?.[1];
  if (song) return { kind: 'meting', server: 'kuwo', type: 'song', id: song, url: url.href };
  const playlist = url.pathname.match(/playlist_detail\/(\d+)/i)?.[1];
  if (playlist) return { kind: 'meting', server: 'kuwo', type: 'playlist', id: playlist, url: url.href };
  return null;
};

const parseSpotify = (url: URL): ParsedLink | null => {
  const parts = url.pathname.split('/').filter(Boolean);
  const typeIndex = parts.findIndex((part) => ['playlist', 'album', 'track', 'episode', 'show'].includes(part.toLowerCase()));
  if (typeIndex < 0 || !parts[typeIndex + 1]) return null;
  const type = parts[typeIndex].toLowerCase();
  const id = parts[typeIndex + 1];
  return {
    kind: 'embed',
    track: {
      id: makeTrackId(),
      title: `Spotify ${type}`,
      artist: 'Spotify',
      externalUrl: `https://open.spotify.com/${type}/${id}`,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      platform: 'spotify',
      playback: 'embed',
    },
  };
};

const parseApple = (url: URL): ParsedLink => ({
  kind: 'embed',
  track: {
    id: makeTrackId(),
    title: decodeURIComponent(url.pathname.split('/').filter(Boolean).slice(-2, -1)[0] ?? 'Apple Music').replace(/-/g, ' '),
    artist: 'Apple Music',
    externalUrl: url.href,
    embedUrl: url.href.replace('://music.apple.com', '://embed.music.apple.com'),
    platform: 'apple',
    playback: 'embed',
  },
});

export const isDirectAudioUrl = (url: URL) => /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)(?:$|[?#])/i.test(url.pathname + url.search);

export const parseMusicLink = (value: string): ParsedLink => {
  const url = toUrl(value);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return { kind: 'unknown', value };
  const host = url.hostname.toLowerCase();
  if (host === '163cn.tv' || host === 'c6.y.qq.com' || host === 'c.y.qq.com' && url.pathname.startsWith('/base/fcgi-bin/u') || host === 't.kugou.com') {
    return { kind: 'short', url: url.href, platform: host.includes('163') ? 'netease' : host.includes('kugou') ? 'kugou' : 'tencent' };
  }
  if (host.endsWith('music.163.com') || host === 'y.music.163.com') return parseNetEase(url) ?? { kind: 'unknown', value };
  if (host.endsWith('y.qq.com') || host === 'i.y.qq.com') return parseTencent(url) ?? { kind: 'unknown', value };
  if (host.endsWith('kugou.com')) return parseKugou(url) ?? { kind: 'unknown', value };
  if (host.endsWith('kuwo.cn')) return parseKuwo(url) ?? { kind: 'unknown', value };
  if (host === 'open.spotify.com' || host.endsWith('.spotify.com')) return parseSpotify(url) ?? { kind: 'unknown', value };
  if (host.includes('music.apple.com') || host.includes('itunes.apple.com')) return parseApple(url);
  if (isDirectAudioUrl(url)) {
    const fileName = decodeURIComponent(url.pathname.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
    return {
      kind: 'direct',
      track: {
        id: makeTrackId(),
        title: fileName || url.hostname,
        artist: url.hostname,
        sourceUrl: url.href,
        externalUrl: url.href,
        platform: 'direct',
        playback: 'native',
      },
    };
  }
  return { kind: 'unknown', value };
};

interface MetingItem {
  title?: string;
  name?: string;
  author?: string;
  artist?: string;
  url?: string;
  pic?: string;
  cover?: string;
  lrc?: string;
}

const metingIdFromUrl = (value: string) => {
  try {
    return new URL(value).searchParams.get('id') ?? '';
  } catch {
    return '';
  }
};

const safeHttpUrl = (base: string, candidate?: string) => {
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate, base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
};

export const metingRequest = async (source: MusicSource, server: MetingServer, type: MetingType, id: string, signal?: AbortSignal) => {
  const url = new URL(source.baseUrl);
  url.searchParams.set('server', server);
  url.searchParams.set('type', type);
  url.searchParams.set('id', id);
  const response = await fetch(url.href, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`meting-http-${response.status}`);
  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) throw new Error('meting-invalid-response');
  return (payload as MetingItem[]).flatMap((item): MediaTrack[] => {
    const audio = safeHttpUrl(source.baseUrl, item.url);
    const title = String(item.title ?? item.name ?? '').trim();
    const songId = audio ? metingIdFromUrl(audio) : '';
    if (!audio || !title || !songId || songId === 'undefined') return [];
    return [{
      id: `${server}-${songId}`,
      title,
      artist: String(item.author ?? item.artist ?? '').trim(),
      sourceUrl: audio,
      cover: safeHttpUrl(source.baseUrl, item.pic ?? item.cover),
      lyricUrl: safeHttpUrl(source.baseUrl, item.lrc),
      platform: server,
      playback: 'native',
      sourceName: source.name,
    }];
  });
};

export const testMusicSource = async (source: MusicSource) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const tracks = await metingRequest(source, 'netease', 'search', '晴天', controller.signal);
    return tracks.length > 0;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
};

export interface LyricLine { time: number; text: string }

export const parseLrc = (raw: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  raw.split(/\r?\n/).forEach((row) => {
    const stamps = [...row.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) return;
    const text = row.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) return;
    stamps.forEach((stamp) => {
      const fraction = stamp[3] ? Number(`0.${stamp[3].padStart(2, '0')}`) : 0;
      lines.push({ time: Number(stamp[1]) * 60 + Number(stamp[2]) + fraction, text });
    });
  });
  return lines.sort((a, b) => a.time - b.time);
};

const lyricCache = new Map<string, Promise<LyricLine[]>>();

export const loadLyrics = (lyricUrl: string) => {
  const cached = lyricCache.get(lyricUrl);
  if (cached) return cached;
  const request = fetch(lyricUrl, { cache: 'force-cache' })
    .then((response) => (response.ok ? response.text() : ''))
    .then(parseLrc)
    .catch(() => [] as LyricLine[]);
  lyricCache.set(lyricUrl, request);
  return request;
};

export const isPlayableTrack = (track: Partial<MediaTrack>) => Boolean(track.sourceUrl || track.blobId || track.embedUrl || track.externalUrl);

export interface DownloadOption {
  url: string;
  size: number;
  format: string;
  mime: string;
  kbps?: number;
  label: { zh: string; en: string };
}

const formatFromType = (mime: string, url: string) => {
  if (/flac/i.test(mime) || /\.flac(\?|$)/i.test(url)) return 'FLAC';
  if (/mp4|m4a|aac/i.test(mime) || /\.(m4a|aac)(\?|$)/i.test(url)) return 'M4A';
  if (/ogg/i.test(mime)) return 'OGG';
  if (/wav/i.test(mime)) return 'WAV';
  return 'MP3';
};

const qualityLabel = (kbps: number | undefined, format: string) => {
  if (format === 'FLAC' || format === 'WAV') return { zh: '无损', en: 'Lossless' };
  if (!kbps) return { zh: '标准', en: 'Standard' };
  if (kbps <= 140) return { zh: '低音质', en: 'Low' };
  if (kbps <= 200) return { zh: '标准', en: 'Standard' };
  if (kbps <= 330) return { zh: '高音质', en: 'High' };
  return { zh: '超高音质', en: 'Very high' };
};

/** Reads size and type with a 2-byte range request (works through the redirect, needs CORS on the final host). */
const probe = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { headers: { Range: 'bytes=0-1' }, signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`probe-${response.status}`);
  const range = response.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : Number(response.headers.get('content-length'));
  void response.body?.cancel();
  return { size: Number.isFinite(total) ? total : 0, mime: response.headers.get('content-type') ?? 'audio/mpeg', finalUrl: response.url };
};

/**
 * Lists the qualities a track really offers. Meting builds that honour a bitrate parameter return
 * different files; when they all match, only one option is shown. Nothing is transcoded.
 */
export const getDownloadOptions = async (track: MediaTrack, durationSeconds: number, signal?: AbortSignal): Promise<DownloadOption[]> => {
  if (!track.sourceUrl) return [];
  const isMeting = track.platform !== 'direct' && /[?&]type=url/.test(track.sourceUrl);
  const candidates = isMeting ? [128, 320, 999].map((br) => `${track.sourceUrl}&br=${br}`) : [track.sourceUrl];
  const results = await Promise.allSettled(candidates.map((url) => probe(url, signal).then((info) => ({ url, ...info }))));
  const seen = new Set<number>();
  const options: DownloadOption[] = [];
  results.forEach((result) => {
    if (result.status !== 'fulfilled' || !result.value.size || seen.has(result.value.size)) return;
    seen.add(result.value.size);
    const format = formatFromType(result.value.mime, result.value.finalUrl);
    const kbps = durationSeconds > 0 ? Math.round((result.value.size * 8) / durationSeconds / 1000) : undefined;
    options.push({ url: result.value.url, size: result.value.size, format, mime: result.value.mime, kbps, label: qualityLabel(kbps, format) });
  });
  // MP3 first, then by size.
  return options.sort((a, b) => Number(b.format === 'MP3') - Number(a.format === 'MP3') || a.size - b.size);
};
