import React from 'react';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';

export const Segmented = <T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (id: T) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((option) => (
      <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${value === option.id ? 'bg-[#17b890] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'}`}>{option.label}</button>
    ))}
  </div>
);

export const GameShell: React.FC<{
  toolbar?: React.ReactNode;
  stats: { label: string; value: React.ReactNode }[];
  onRestart: () => void;
  restartLabel: string;
  sound?: boolean;
  onToggleSound?: () => void;
  extraButtons?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
}> = ({ toolbar, stats, onRestart, restartLabel, sound, onToggleSound, extraButtons, footer, maxWidth = 640, children }) => (
  <div className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-[#f5f8f6] p-3 text-gray-800 dark:bg-[#171817] dark:text-gray-100 sm:p-5">
    <div className="mx-auto w-full" style={{ maxWidth }}>
      {toolbar && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-white/10">{toolbar}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {stats.map((item) => <span key={item.label}><span className="text-gray-500 dark:text-gray-400">{item.label}</span> <strong className="tabular-nums">{item.value}</strong></span>)}
        </div>
        <div className="flex gap-1.5">
          {extraButtons}
          <button type="button" onClick={onRestart} className="game-icon-button" title={restartLabel} aria-label={restartLabel}><RotateCcw size={16} /></button>
          {onToggleSound && <button type="button" onClick={onToggleSound} className="game-icon-button" aria-label={sound ? 'Mute' : 'Sound on'}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>}
        </div>
      </div>
      {children}
      {footer && <div className="mt-4 text-center text-xs leading-5 text-gray-500 dark:text-gray-400">{footer}</div>}
    </div>
  </div>
);

export const ResultBanner: React.FC<{ tone: 'win' | 'lose'; title: string; detail?: string; action: string; onAction: () => void }> = ({ tone, title, detail, action, onAction }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#f5f8f6]/85 backdrop-blur-sm dark:bg-[#171817]/85">
    <div className="text-center">
      <div className={`text-xl font-bold ${tone === 'win' ? 'text-[#0d8064] dark:text-[#78d9bf]' : 'text-[#c2410c] dark:text-[#fb923c]'}`}>{title}</div>
      {detail && <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</div>}
      <button type="button" onClick={onAction} className="mt-3 rounded-md bg-[#17b890] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105">{action}</button>
    </div>
  </div>
);
