import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bomb, Flag, Pickaxe } from 'lucide-react';
import { useI18n } from '../../i18n';
import { formatGameTime, playGameTone } from './gameAudio';
import { GameShell, ResultBanner, Segmented } from './GameShell';
import { useBest, useSound, useTimer } from './gameHooks';

type Level = 'easy' | 'medium' | 'hard';
interface Cell { mine: boolean; open: boolean; flag: boolean; count: number }

const LEVELS: Record<Level, { cols: number; rows: number; mines: number }> = {
  easy: { cols: 9, rows: 9, mines: 10 },
  medium: { cols: 12, rows: 12, mines: 24 },
  hard: { cols: 16, rows: 14, mines: 40 },
};
const NUMBER_COLORS = ['', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#b45309', '#0891b2', '#111827', '#6b7280'];

const emptyBoard = (level: Level): Cell[] => Array.from({ length: LEVELS[level].cols * LEVELS[level].rows }, () => ({ mine: false, open: false, flag: false, count: 0 }));

const neighbours = (index: number, cols: number, rows: number) => {
  const x = index % cols;
  const y = Math.floor(index / cols);
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (!dx && !dy) continue;
    const nx = x + dx; const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) result.push(ny * cols + nx);
  }
  return result;
};

export const MinesweeperGame: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const [level, setLevel] = useState<Level>('easy');
  const [board, setBoard] = useState<Cell[]>(() => emptyBoard('easy'));
  const [state, setState] = useState<'ready' | 'playing' | 'won' | 'lost'>('ready');
  const [flagMode, setFlagMode] = useState(false);
  const [sound, toggleSound] = useSound();
  const [seconds, setSeconds] = useTimer(state === 'playing');
  const [best, saveBest] = useBest<Partial<Record<Level, number>>>('liu-os-mines-best-v1', {});
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const { cols, rows, mines } = LEVELS[level];

  const restart = useCallback((next: Level = level) => {
    setLevel(next);
    setBoard(emptyBoard(next));
    setState('ready');
    setSeconds(0);
  }, [level, setSeconds]);

  const plant = (safeIndex: number): Cell[] => {
    const cells = emptyBoard(level);
    const forbidden = new Set([safeIndex, ...neighbours(safeIndex, cols, rows)]);
    let placed = 0;
    while (placed < mines) {
      const index = Math.floor(Math.random() * cells.length);
      if (forbidden.has(index) || cells[index].mine) continue;
      cells[index].mine = true;
      placed += 1;
    }
    cells.forEach((cell, index) => { cell.count = neighbours(index, cols, rows).filter((n) => cells[n].mine).length; });
    return cells;
  };

  const finish = (cells: Cell[], outcome: 'won' | 'lost') => {
    setState(outcome);
    if (outcome === 'lost') {
      playGameTone(sound, 140, 0.3, 'sawtooth');
      setBoard(cells.map((cell) => (cell.mine ? { ...cell, open: true } : cell)));
      return;
    }
    playGameTone(sound, 880, 0.18);
    setBoard(cells.map((cell) => (cell.mine ? { ...cell, flag: true } : cell)));
    if (!best[level] || seconds < (best[level] ?? Infinity)) saveBest({ ...best, [level]: seconds });
  };

  const openCells = (cells: Cell[], start: number) => {
    const stack = [start];
    while (stack.length) {
      const index = stack.pop()!;
      const cell = cells[index];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      if (cell.count === 0 && !cell.mine) neighbours(index, cols, rows).forEach((n) => { if (!cells[n].open) stack.push(n); });
    }
  };

  const reveal = (index: number) => {
    if (state === 'won' || state === 'lost') return;
    let cells = board.map((cell) => ({ ...cell }));
    if (state === 'ready') {
      cells = plant(index);
      setState('playing');
    }
    const cell = cells[index];
    if (cell.flag) return;
    if (cell.open) {
      // Chord: open the neighbours when the flags around a number match it.
      const around = neighbours(index, cols, rows);
      if (cell.count && around.filter((n) => cells[n].flag).length === cell.count) {
        for (const n of around) {
          if (!cells[n].flag && !cells[n].open) {
            if (cells[n].mine) { cells[n].open = true; finish(cells, 'lost'); return; }
            openCells(cells, n);
          }
        }
      } else return;
    } else {
      if (cell.mine) { cell.open = true; finish(cells, 'lost'); return; }
      openCells(cells, index);
    }
    playGameTone(sound, 520, 0.035);
    setBoard(cells);
    if (cells.every((item) => item.mine || item.open)) finish(cells, 'won');
  };

  const toggleFlag = (index: number) => {
    if (state === 'won' || state === 'lost' || board[index].open) return;
    playGameTone(sound, 330, 0.04);
    setBoard((current) => current.map((cell, i) => (i === index ? { ...cell, flag: !cell.flag } : cell)));
  };

  useEffect(() => () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }, []);

  const flags = board.filter((cell) => cell.flag).length;
  const levelLabel = { easy: zh ? '初级' : 'Easy', medium: zh ? '中级' : 'Medium', hard: zh ? '高级' : 'Hard' };

  return (
    <GameShell
      maxWidth={cols > 12 ? 720 : 560}
      toolbar={<Segmented value={level} onChange={(next) => restart(next)} options={(['easy', 'medium', 'hard'] as Level[]).map((id) => ({ id, label: levelLabel[id] }))} />}
      stats={[
        { label: zh ? '剩余雷' : 'Mines', value: mines - flags },
        { label: zh ? '用时' : 'Time', value: formatGameTime(seconds) },
        { label: zh ? '最佳' : 'Best', value: best[level] !== undefined ? formatGameTime(best[level]!) : '--' },
      ]}
      onRestart={() => restart()}
      restartLabel={zh ? '重新开始' : 'Restart'}
      sound={sound}
      onToggleSound={toggleSound}
      extraButtons={<button type="button" onClick={() => setFlagMode((value) => !value)} className={`game-icon-button ${flagMode ? '!bg-[#17b890] !text-white' : ''}`} aria-pressed={flagMode} title={zh ? '插旗模式（手机用）' : 'Flag mode'}>{flagMode ? <Flag size={16} /> : <Pickaxe size={16} />}</button>}
      footer={zh ? '点格子挖开，右键或长按插旗；点已翻开的数字可以快速翻开周围。第一下一定安全。' : 'Tap to dig, right-click or long-press to flag. Tap a number to clear around it. The first tap is always safe.'}
    >
      <div className="relative mx-auto rounded-xl bg-[#cfe0da] p-1.5 shadow-inner dark:bg-[#22302c]" style={{ maxWidth: cols * 40 }}>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} onContextMenu={(event) => event.preventDefault()}>
          {board.map((cell, index) => (
            <button
              key={index}
              type="button"
              aria-label={cell.open ? (cell.mine ? 'mine' : String(cell.count)) : cell.flag ? 'flag' : 'hidden'}
              onClick={() => { if (longPressed.current) { longPressed.current = false; return; } if (flagMode && !cell.open) toggleFlag(index); else reveal(index); }}
              onContextMenu={(event) => { event.preventDefault(); toggleFlag(index); }}
              onPointerDown={(event) => {
                if (event.pointerType !== 'touch') return;
                longPressed.current = false;
                pressTimer.current = window.setTimeout(() => { longPressed.current = true; toggleFlag(index); navigator.vibrate?.(15); }, 380);
              }}
              onPointerUp={() => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }}
              onPointerLeave={() => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }}
              className={`flex aspect-square select-none items-center justify-center rounded-[5px] text-[clamp(11px,2.6vw,17px)] font-bold transition-colors ${cell.open
                ? (cell.mine ? 'bg-[#f87171] text-white' : 'bg-[#f3f7f5] dark:bg-[#2c3a36]')
                : 'bg-[#6fa596] shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] hover:bg-[#7fb5a6] active:scale-95 dark:bg-[#3f6b5f] dark:hover:bg-[#4a7b6e]'}`}
              style={cell.open && !cell.mine && cell.count ? { color: NUMBER_COLORS[cell.count] } : undefined}
            >
              {cell.open ? (cell.mine ? <Bomb size={14} /> : cell.count || '') : cell.flag ? <Flag size={13} className="text-[#fef3c7]" fill="#f97316" /> : ''}
            </button>
          ))}
        </div>
        {state === 'won' && <ResultBanner tone="win" title={zh ? '全部排除！' : 'Cleared!'} detail={`${zh ? '用时' : 'Time'} ${formatGameTime(seconds)}`} action={zh ? '再来一局' : 'Play again'} onAction={() => restart()} />}
        {state === 'lost' && <ResultBanner tone="lose" title={zh ? '踩到雷了' : 'Boom!'} action={zh ? '再试一次' : 'Try again'} onAction={() => restart()} />}
      </div>
    </GameShell>
  );
};

export default MinesweeperGame;
