import { useEffect, useState } from 'react';
import { places, readSaved, save, type Weather, type Group } from './model';

export function useWeather(group: Group | 'all') {
  const [weather, setWeather] = useState<Record<string, Weather>>(() => {
    const cached = readSaved<Record<string, Weather>>('liu-world-weather', {});
    return Object.fromEntries(Object.entries(cached).filter(([, value]) => value && Number.isFinite(value.code) && Number.isFinite(value.temperature) && Number.isFinite(value.fetchedAt) && Date.now() - value.fetchedAt < 3600000));
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const update = async () => {
      setLoading(true);
      const result: Record<string, Weather> = {};
      const cached = readSaved<Record<string, Weather>>('liu-world-weather', {});
      const needed = places.filter(p => (group === 'all' || p.group === group) && (!Number.isFinite(cached[p.id]?.fetchedAt) || !Number.isFinite(cached[p.id]?.code) || !Number.isFinite(cached[p.id]?.temperature) || Date.now() - cached[p.id].fetchedAt >= 1800000));
      for (let start = 0; start < needed.length && !stopped; start += 24) {
        const batch = needed.slice(start, start + 24);
        const query = new URLSearchParams({ latitude: batch.map(p => p.lat).join(','), longitude: batch.map(p => p.lng).join(','), current: 'temperature_2m,weather_code', timezone: 'auto', forecast_days: '1' });
        try {
          const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
          if (!response.ok) continue;
          const data = await response.json();
          if (!Array.isArray(data)) continue;
          data.forEach((item, index) => {
            if (!batch[index] || !Number.isFinite(item.current?.weather_code) || !Number.isFinite(item.current?.temperature_2m)) return;
            result[batch[index].id] = { code: item.current.weather_code, temperature: item.current.temperature_2m, offset: item.utc_offset_seconds, timezone: item.timezone, fetchedAt: Date.now() };
          });
          if (!stopped) setWeather(old => ({ ...old, ...result }));
        } catch { /* A failed weather feed does not block maps, local time, or live streams. */ }
      }
      if (!stopped) { setLoading(false); if (Object.keys(result).length) save('liu-world-weather', { ...cached, ...result }); }
    };
    void update();
    const interval = window.setInterval(() => { if (!document.hidden) void update(); }, 1800000);
    return () => { stopped = true; controller.abort(); clearInterval(interval); };
  }, [group]);
  return { weather, loading };
}
