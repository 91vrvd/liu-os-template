import React, { useState } from 'react';

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

/**
 * Playback progress bar. While the thumb is dragged it only moves locally; the seek is sent once on
 * release, so the audio is not asked to jump (and re-buffer) dozens of times, and incoming
 * timeupdate events do not yank the thumb back mid-drag.
 */
export const Scrubber: React.FC<{
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  label: string;
  showTimes?: boolean;
  tone?: 'default' | 'light' | 'accent';
  className?: string;
}> = ({ position, duration, onSeek, label, showTimes = true, tone = 'default', className = '' }) => {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const max = duration > 0 ? duration : 0;
  const shown = Math.min(dragValue ?? position, max || 0);
  const percent = max ? (shown / max) * 100 : 0;
  const disabled = !max;

  const commit = () => {
    if (dragValue === null) return;
    onSeek(dragValue);
    setDragValue(null);
  };

  const trackClass = tone === 'light' ? 'bg-white/25' : 'bg-black/10 dark:bg-white/15';
  const fillClass = tone === 'light' ? 'bg-white' : tone === 'accent' ? 'bg-[#fa233b]' : 'bg-black/70 dark:bg-white/80';
  const timeClass = tone === 'light' ? 'text-white/70' : 'opacity-60';

  return (
    <div className={`flex items-center gap-2 text-[10px] tabular-nums ${className}`}>
      {showTimes && <span className={`w-9 text-right ${timeClass}`}>{formatTime(shown)}</span>}
      <div className={`group relative h-4 flex-1 ${disabled ? 'opacity-50' : ''}`}>
        <div className={`absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full transition-[height] group-hover:h-1.5 ${trackClass}`}>
          <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${percent}%` }} />
        </div>
        <span
          className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow transition-opacity ${fillClass} ${dragValue !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ left: `${percent}%` }}
        />
        <input
          type="range"
          aria-label={label}
          min={0}
          max={max || 1}
          step={0.1}
          value={shown}
          disabled={disabled}
          onPointerDown={() => setDragValue(position)}
          onChange={(event) => {
            const value = Number(event.target.value);
            // Keyboard arrows and plain clicks without a pointer drag seek straight away.
            if (dragValue === null) onSeek(value);
            else setDragValue(value);
          }}
          onPointerUp={commit}
          onPointerCancel={commit}
          onBlur={commit}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </div>
      {showTimes && <span className={`w-9 ${timeClass}`}>{max ? `-${formatTime(max - shown)}` : '0:00'}</span>}
    </div>
  );
};
