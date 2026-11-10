import { useEffect, useRef, useState } from 'react';
import type { Place } from './model';
import { writeStreamHealth } from './streamHealth';

type Status = 'loading' | 'ready' | 'replay' | 'network' | 'removed' | 'restricted' | 'unavailable';

const ORIGIN = 'https://www.youtube-nocookie.com';

export default function LivePlayer({ place, english, onNext }: { place: Place; english: boolean; onNext?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>(place.videoId ? 'loading' : 'unavailable');
  const t = (zh: string, en: string) => (english ? en : zh);

  useEffect(() => {
    if (!place.videoId) { setStatus('unavailable'); return undefined; }
    setStatus('loading');
    const timeout = window.setTimeout(() => setStatus((value) => (value === 'loading' ? 'network' : value)), 15000);
    const listen = window.setInterval(() => {
      const player = frame.current?.contentWindow;
      player?.postMessage(JSON.stringify({ event: 'listening', id: 'world-player' }), ORIGIN);
      // The iframe API only forwards error events after a listener subscribes.
      player?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onError'] }), ORIGIN);
    }, 700);
    const receive = (event: MessageEvent) => {
      if (event.origin !== ORIGIN || event.source !== frame.current?.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'onError') {
          window.clearTimeout(timeout);
          const code = Number(data.info);
          // 100: removed or private · 101/150/152/153: owner or YouTube blocks embedding here · 2/5: bad request / HTML5 error
          const next: Status = code === 100 ? 'removed' : [101, 150, 152, 153].includes(code) ? 'restricted' : 'unavailable';
          setStatus(next);
          writeStreamHealth(place.id, String(code));
        } else if (data.event === 'infoDelivery' || data.event === 'onReady') {
          window.clearTimeout(timeout);
          const live = data.info?.videoData?.isLive;
          setStatus((value) => {
            if (value === 'removed' || value === 'restricted' || value === 'unavailable') return value;
            if (live === false) return 'replay';
            return value === 'replay' ? value : 'ready';
          });
          if (live === true) writeStreamHealth(place.id, null);
        }
      } catch { /* Ignore messages unrelated to the player API. */ }
    };
    window.addEventListener('message', receive);
    return () => { clearTimeout(timeout); clearInterval(listen); window.removeEventListener('message', receive); };
  }, [place.id, place.videoId, attempt]);

  const watchUrl = place.videoId ? `https://www.youtube.com/watch?v=${place.videoId}` : null;
  // sp=EgJAAQ== is YouTube's "Live" filter, so the search only lists streams that are on air now.
  const liveSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${place.en} live cam`)}&sp=EgJAAQ%253D%253D`;
  const failed = status === 'network' || status === 'removed' || status === 'restricted' || status === 'unavailable';

  const message: Record<Status, string> = {
    loading: t('正在连接世界的这一角…', 'Connecting to this corner of the world…'),
    ready: '',
    replay: t('这场直播已经结束，现在播放的是录像回放。可以搜一下这里正在直播的其他画面。', 'This stream has ended, so you are seeing a recording. Search for cameras that are live here now.'),
    network: t('连不上 YouTube。在中国大陆需要可以访问 YouTube 的网络；也可能是网络较慢，可以重试。', 'Could not reach YouTube. Your network may block it or be slow; try again.'),
    removed: t('这个直播已被频道删除或设为私享。', 'This stream was removed or made private by its channel.'),
    restricted: t('频道不允许在其他网站播放，或 YouTube 需要先登录验证。可以到 YouTube 观看。', 'The channel does not allow playback on other sites, or YouTube is asking to sign in. Watch it on YouTube.'),
    unavailable: place.videoId
      ? t('这个画面暂时无法播放。', 'This view cannot play right now.')
      : t('这里暂时没有稳定的直播源，可以在 YouTube 搜索当前正在直播的画面。', 'No stable stream here right now. Search YouTube for cameras that are live now.'),
  };

  return <>
    {place.videoId && <div className={`world-video ${failed ? 'world-video-unavailable' : ''}`}>
      <iframe key={`${place.id}-${attempt}`} ref={frame} title={english ? `${place.en} live camera` : `${place.zh}实况`} src={`${ORIGIN}/embed/${place.videoId}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}&autoplay=1&mute=1&playsinline=1&rel=0&hl=${english ? 'en' : 'zh-CN'}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      {status === 'ready' && <span className="world-live-badge">● LIVE</span>}
      {status === 'replay' && <span className="world-live-badge world-live-badge-replay">{t('回放', 'Replay')}</span>}
    </div>}
    <div className="world-player-status" role="status">
      {message[status] && <p>{message[status]}</p>}
      <div className="world-player-actions">
        {failed && place.videoId && status !== 'removed' && <button onClick={() => setAttempt((value) => value + 1)}>{t('重新连接', 'Try again')}</button>}
        {(failed || status === 'replay') && onNext && <button onClick={onNext}>{t('换一个直播', 'Next camera')}</button>}
        {(failed || status === 'replay' || !place.videoId) && <a href={liveSearchUrl} target="_blank" rel="noopener noreferrer">{t('搜索这里的直播 ↗', 'Find live cams here ↗')}</a>}
        {watchUrl && status !== 'removed' && <a href={watchUrl} target="_blank" rel="noopener noreferrer">{t('在 YouTube 打开 ↗', 'Open on YouTube ↗')}</a>}
      </div>
      <small>{t('直播由原频道提供，能否播放取决于频道设置和你的网络。', 'Streams belong to their channels; playback depends on channel settings and your network.')}</small>
    </div>
  </>;
}
