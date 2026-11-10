import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eraser, Lightbulb, PencilLine } from 'lucide-react';
import { useI18n } from '../../i18n';
import { formatGameTime, playGameTone } from './gameAudio';
import { GameShell, ResultBanner, Segmented } from './GameShell';
import { useBest, useSound, useTimer } from './gameHooks';

type Level = 'easy' | 'medium' | 'hard';
const CLUES: Record<Level, number> = { easy: 40, medium: 32, hard: 26 };

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const canPlace = (grid: number[], index: number, value: number) => {
  const row = Math.floor(index / 9); const col = index % 9;
  for (let i = 0; i < 9; i += 1) {
    if (grid[row * 9 + i] === value || grid[i * 9 + col] === value) return false;
  }
  const br = Math.floor(row / 3) * 3; const bc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) if (grid[(br + r) * 9 + bc + c] === value) return false;
  return true;
};

const fill = (grid: number[]): boolean => {
  const index = grid.indexOf(0);
  if (index < 0) return true;
  for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (!canPlace(grid, index, value)) continue;
    grid[index] = value;
    if (fill(grid)) return true;
    grid[index] = 0;
  }
  return false;
};

const countSolutions = (grid: number[], limit = 2): number => {
  const index = grid.indexOf(0);
  if (index < 0) return 1;
  let count = 0;
  for (let value = 1; value <= 9 && count < limit; value += 1) {
    if (!canPlace(grid, index, value)) continue;
    grid[index] = value;
    count += countSolutions(grid, limit - count);
    grid[index] = 0;
  }
  return count;
};

/** Builds a puzzle with exactly one solution. */
const makePuzzle = (level: Level) => {
  const solution = Array(81).fill(0);
  fill(solution);
  const puzzle = [...solution];
  let filled = 81;
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (filled <= CLUES[level]) break;
    const saved = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions([...puzzle]) !== 1) puzzle[index] = saved;
    else filled -= 1;
  }
  return { puzzle, solution };
};

export const SudokuGame: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const [level, setLevel] = useState<Level>('easy');
  const [game, setGame] = useState(() => makePuzzle('easy'));
  const [values, setValues] = useState<number[]>(() => game.puzzle);
  const [notes, setNotes] = useState<number[][]>(() => Array.from({ length: 81 }, () => []));
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [won, setWon] = useState(false);
  const [sound, toggleSound] = useSound();
  const [seconds, setSeconds] = useTimer(!won);
  const [best, saveBest] = useBest<Partial<Record<Level, number>>>('liu-os-sudoku-best-v1', {});

  const restart = useCallback((next: Level = level) => {
    const fresh = makePuzzle(next);
    setLevel(next);
    setGame(fresh);
    setValues(fresh.puzzle);
    setNotes(Array.from({ length: 81 }, () => []));
    setSelected(null);
    setMistakes(0);
    setWon(false);
    setSeconds(0);
  }, [level, setSeconds]);

  const input = useCallback((value: number) => {
    if (selected === null || won || game.puzzle[selected]) return;
    if (value === 0) {
      setValues((current) => current.map((item, i) => (i === selected ? 0 : item)));
      setNotes((current) => current.map((item, i) => (i === selected ? [] : item)));
      return;
    }
    if (noteMode) {
      setNotes((current) => current.map((item, i) => (i === selected ? (item.includes(value) ? item.filter((n) => n !== value) : [...item, value].sort()) : item)));
      return;
    }
    const next = values.map((item, i) => (i === selected ? value : item));
    setValues(next);
    if (value !== game.solution[selected]) {
      setMistakes((count) => count + 1);
      playGameTone(sound, 200, 0.12, 'triangle');
      return;
    }
    playGameTone(sound, 560, 0.04);
    if (next.every((item, i) => item === game.solution[i])) {
      setWon(true);
      playGameTone(sound, 880, 0.2);
      if (!best[level] || seconds < (best[level] ?? Infinity)) saveBest({ ...best, [level]: seconds });
    }
  }, [best, game, level, noteMode, saveBest, seconds, selected, sound, values, won]);

  const hint = () => {
    const target = selected !== null && !game.puzzle[selected] && values[selected] !== game.solution[selected]
      ? selected
      : values.findIndex((item, i) => item !== game.solution[i]);
    if (target < 0) return;
    setSelected(target);
    const next = values.map((item, i) => (i === target ? game.solution[target] : item));
    setValues(next);
    setSeconds((value) => value + 15);
    if (next.every((item, i) => item === game.solution[i])) setWon(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[1-9]$/.test(event.key)) input(Number(event.key));
      else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') input(0);
      else if (event.key === 'n' || event.key === 'N') setNoteMode((value) => !value);
      else if (selected !== null && event.key.startsWith('Arrow')) {
        event.preventDefault();
        const delta = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[event.key] ?? 0;
        setSelected((current) => (current === null ? 0 : (current + delta + 81) % 81));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, selected]);

  const counts = useMemo(() => {
    const result = Array(10).fill(0);
    values.forEach((value, i) => { if (value && value === game.solution[i]) result[value] += 1; });
    return result;
  }, [game.solution, values]);
  const selectedValue = selected !== null ? values[selected] : 0;
  const levelLabel = { easy: zh ? '简单' : 'Easy', medium: zh ? '中等' : 'Medium', hard: zh ? '困难' : 'Hard' };

  return (
    <GameShell
      maxWidth={520}
      toolbar={<Segmented value={level} onChange={(next) => restart(next)} options={(['easy', 'medium', 'hard'] as Level[]).map((id) => ({ id, label: levelLabel[id] }))} />}
      stats={[
        { label: zh ? '用时' : 'Time', value: formatGameTime(seconds) },
        { label: zh ? '错误' : 'Mistakes', value: mistakes },
        { label: zh ? '最佳' : 'Best', value: best[level] !== undefined ? formatGameTime(best[level]!) : '--' },
      ]}
      onRestart={() => restart()}
      restartLabel={zh ? '换一题' : 'New puzzle'}
      sound={sound}
      onToggleSound={toggleSound}
      footer={zh ? '每行、每列、每个 3×3 宫格都要填满 1-9 且不重复。键盘可直接输入数字，N 切换笔记，方向键移动；提示会加 15 秒。' : 'Fill every row, column and 3×3 box with 1-9. Type numbers, press N for notes, arrows to move. A hint costs 15 seconds.'}
    >
      <div className="relative mx-auto w-full max-w-[460px]">
        <div className="grid grid-cols-9 overflow-hidden rounded-xl border-2 border-[#24483f] bg-white dark:border-[#9dc5bb] dark:bg-[#1f2725]">
          {values.map((value, index) => {
            const row = Math.floor(index / 9); const col = index % 9;
            const given = Boolean(game.puzzle[index]);
            const wrong = value && value !== game.solution[index];
            const related = selected !== null && (Math.floor(selected / 9) === row || selected % 9 === col || (Math.floor(Math.floor(selected / 9) / 3) === Math.floor(row / 3) && Math.floor((selected % 9) / 3) === Math.floor(col / 3)));
            const same = selectedValue && value === selectedValue;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setSelected(index)}
                className={`relative flex aspect-square items-center justify-center text-[clamp(14px,4.2vw,22px)] transition-colors
                  ${col % 3 === 2 && col < 8 ? 'border-r-2 border-r-[#24483f] dark:border-r-[#9dc5bb]' : 'border-r border-r-gray-200 dark:border-r-white/10'}
                  ${row % 3 === 2 && row < 8 ? 'border-b-2 border-b-[#24483f] dark:border-b-[#9dc5bb]' : 'border-b border-b-gray-200 dark:border-b-white/10'}
                  ${selected === index ? 'bg-[#bfe8db] dark:bg-[#2f6b5b]' : same ? 'bg-[#dff2ec] dark:bg-[#24443b]' : related ? 'bg-[#f1f7f5] dark:bg-[#26302d]' : ''}
                  ${given ? 'font-bold text-gray-900 dark:text-white' : wrong ? 'font-semibold text-red-500' : 'font-semibold text-[#0d8064] dark:text-[#78d9bf]'}`}
              >
                {value ? value : notes[index].length ? (
                  <span className="grid h-full w-full grid-cols-3 p-0.5 text-[clamp(7px,1.6vw,10px)] leading-none text-gray-500 dark:text-gray-400">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <span key={n} className="flex items-center justify-center">{notes[index].includes(n) ? n : ''}</span>)}
                  </span>
                ) : ''}
              </button>
            );
          })}
        </div>
        {won && <ResultBanner tone="win" title={zh ? '完成！' : 'Solved!'} detail={`${formatGameTime(seconds)} · ${zh ? '错误' : 'Mistakes'} ${mistakes}`} action={zh ? '再来一题' : 'Next puzzle'} onAction={() => restart()} />}
      </div>
      <div className="mx-auto mt-3 grid max-w-[460px] grid-cols-9 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" disabled={counts[n] >= 9} onClick={() => input(n)} className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg bg-white text-lg font-semibold shadow-sm transition hover:bg-[#e1f3ed] disabled:opacity-25 dark:bg-white/10 dark:hover:bg-white/15">
            {n}<span className="text-[9px] font-normal opacity-50">{9 - counts[n]}</span>
          </button>
        ))}
      </div>
      <div className="mx-auto mt-2 flex max-w-[460px] justify-center gap-2">
        <button type="button" onClick={() => input(0)} className="game-control-button"><Eraser size={15} />{zh ? '擦除' : 'Erase'}</button>
        <button type="button" onClick={() => setNoteMode((value) => !value)} className={`game-control-button ${noteMode ? '!bg-[#17b890] !text-white' : ''}`}><PencilLine size={15} />{zh ? `笔记 ${noteMode ? '开' : '关'}` : `Notes ${noteMode ? 'on' : 'off'}`}</button>
        <button type="button" onClick={hint} className="game-control-button"><Lightbulb size={15} />{zh ? '提示' : 'Hint'}</button>
      </div>
    </GameShell>
  );
};

export default SudokuGame;
