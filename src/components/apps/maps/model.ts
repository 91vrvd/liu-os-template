import catalog from './places.json';

export type Group = 'city' | 'wildlife' | 'transport';
export type Place = { id: string; zh: string; en: string; country: string; lat: number; lng: number; offset: number; videoId: string | null; timezone?: string; group?: Group; category?: string; keywords?: string; indoor?: boolean; peakMonths?: number[] };
export const places = catalog as Place[];
export type Weather = { code: number; temperature: number; offset: number; timezone: string; fetchedAt: number };
export type Filter = 'all' | 'clear' | 'cloud' | 'rain' | 'snow' | 'golden' | 'night' | 'day' | 'season';
export const weatherGroup = (code: number): Filter => code <= 1 ? 'clear' : code <= 3 || code === 45 || code === 48 ? 'cloud' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' : 'rain';
export const localTime = (place: Place, now: number, weather?: Weather) => {
  if (weather?.timezone || place.timezone) {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: weather?.timezone || place.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now); }
    catch { /* An invalid cached timezone should never prevent opening the map. */ }
  }
  return new Date(now + (Number.isFinite(weather?.offset) ? weather!.offset : place.offset) * 1000).toISOString().slice(11, 16);
};

// NOAA fractional-year equations, evaluated in UTC. The globe and filters share
// the same subsolar point, so dragging the camera cannot move Earth's night.
export function solarPosition(now: number) {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const gamma = 2 * Math.PI / days * ((now - Date.UTC(year, 0, 1)) / 86400000 - 0.5);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const longitude = 180 - (minutes + equation) / 4;
  return { lat: declination * 180 / Math.PI, lng: ((longitude + 540) % 360) - 180 };
}

export function solarElevation(place: Pick<Place, 'lat' | 'lng'>, now: number) {
  const sun = solarPosition(now);
  const rad = Math.PI / 180;
  const cosine = Math.sin(place.lat * rad) * Math.sin(sun.lat * rad) + Math.cos(place.lat * rad) * Math.cos(sun.lat * rad) * Math.cos((place.lng - sun.lng) * rad);
  return Math.asin(Math.max(-1, Math.min(1, cosine))) / rad;
}

export function matches(place: Place, filter: Filter, now: number, weather?: Weather) {
  if (filter === 'all') return true;
  if (filter === 'season') return !!place.peakMonths?.includes(new Date(now + place.offset * 1000).getUTCMonth() + 1);
  if (place.indoor && ['day', 'night', 'golden'].includes(filter)) return false;
  if (filter === 'day') return solarElevation(place, now) > 0;
  if (filter === 'golden') return Math.abs(solarElevation(place, now)) < 6;
  if (filter === 'night') return solarElevation(place, now) < -6;
  return !!weather && now - weather.fetchedAt < 3600000 && weatherGroup(weather.code) === filter;
}

export function readSaved<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browsing still works when storage is unavailable. */ }
}
