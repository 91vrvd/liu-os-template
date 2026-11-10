/** Streams that failed in this browser recently, so the list can mark them and "next" can skip them. */
const HEALTH_KEY = 'liu-os-live-health-v1';
const HEALTH_TTL = 6 * 60 * 60 * 1000;

export const readStreamHealth = (): Record<string, { code: string; at: number }> => {
  try {
    const raw = JSON.parse(localStorage.getItem(HEALTH_KEY) || '{}') as Record<string, { code: string; at: number }>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, value]) => now - value.at < HEALTH_TTL));
  } catch {
    return {};
  }
};

export const writeStreamHealth = (placeId: string, code: string | null) => {
  try {
    const health = readStreamHealth();
    if (code) health[placeId] = { code, at: Date.now() };
    else delete health[placeId];
    localStorage.setItem(HEALTH_KEY, JSON.stringify(health));
    window.dispatchEvent(new Event('liu-live-health'));
  } catch { /* storage may be blocked */ }
};

