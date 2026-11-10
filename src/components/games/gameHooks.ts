import React from 'react';

export const useBest = <T,>(key: string, initial: T) => {
  const [value, setValue] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const save = React.useCallback((next: T) => {
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  }, [key]);
  return [value, save] as const;
};

export const useSound = () => {
  const [sound, setSound] = React.useState(() => {
    try { return localStorage.getItem('liu-os-game-sound') !== 'off'; } catch { return true; }
  });
  const toggle = () => setSound((value) => {
    try { localStorage.setItem('liu-os-game-sound', value ? 'off' : 'on'); } catch { /* ignore */ }
    return !value;
  });
  return [sound, toggle] as const;
};

export const useTimer = (running: boolean) => {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return [seconds, setSeconds] as const;
};

