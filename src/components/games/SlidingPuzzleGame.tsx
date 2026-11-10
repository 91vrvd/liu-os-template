import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { formatGameTime, playGameTone } from './gameAudio';
import { GameShell, ResultBanner, Segmented } from './GameShell';
import { useBest, useSound, useTimer } from './gameHooks';

type Size = '3' | '4' | '5';

const solved = (n: number) => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0];

/** Shuffles with random legal moves, so every board is solvable. */
const scramble = (n: number): number[] => {
  const tiles = solved(n);
  let blank = tiles.length - 1;
  let previous = -1;
  for (let i = 0; i < n * n * 40; i += 1) {
    const x = blank % n; const y = Math.floor(blank / n);
    const options = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < n && ny < n)
      .map(([nx, ny]) => ny * n + nx)
      .filter((index) => index !== previous);
    const pick = options[Math.floor(Math.random() * options.length)];
    [tiles[blank], tiles[pick]] = [tiles[pick], tiles[blank]];
    previous = blank;
    blank = pick;
  }
  return tiles.every((tile, i) => tile === solved(n)[i]) ? scramble(n) : tiles;
};

export const SlidingPuzzleGame: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const [size, setSize] = useState<Size>('4');
  const n = Number(size);
  const [tiles, setTiles] = useState(() => scramble(4));
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [sound, toggleSound] = useSound();
  const [seconds, setSeconds] = useTimer(moves > 0 && !won);
  const [best, saveBest] = useBest<Partial<Record<Size, { moves: number; seconds: number }>>>('liu-os-slide-best-v1', {});

  const restart = useCallback((next: Size = size) => {
    setSize(next);
    setTiles(scramble(Number(next)));
    setMoves(0);
    setWon(false);
    setSeconds(0);
  }, [setSeconds, size]);

  // Clicking any tile in the blank's row or column slides the whole line, like the physical puzzle.
  const slide = useCallback((index: number) => {
    if (won) return;
    const blank = tiles.indexOf(0);
    const bx = blank % n; const by = Math.floor(blank / n);
    const tx = index % n; const ty = Math.floor(index / n);
    if (index === blank || (bx !== tx && by !== ty)) return;
    const next = [...tiles];
    const step = bx === tx ? (ty > by ? n : -n) : (tx > bx ? 1 : -1);
    let cursor = blank;
    let count = 0;
    while (cursor !== index) {
      next[cursor] = next[cursor + step];
      cursor += step;
      count += 1;
    }
    next[index] = 0;
    setTiles(next);
    setMoves((value) => value + count);
    playGameTone(sound, 440 + count * 40, 0.035);
    if (next.every((tile, i) => tile === solved(n)[i])) {
      setWon(true);
      playGameTone(sound, 880, 0.2);
      const total = moves + count;
      const record = best[size];
      if (!record || total < record.moves || (total === record.moves && seconds < record.seconds)) saveBest({ ...best, [size]: { moves: total, seconds } });
    }
  }, [best, moves, n, saveBest, seconds, size, sound, tiles, won]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const blank = tiles.indexOf(0);
      const bx = blank % n; const by = Math.floor(blank / n);
      // Arrow keys move the tile *into* the blank, from the opposite side.
      const map: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 0], ArrowRight: [-1, 0] };
      const delta = map[event.key];
      if (!delta) return;
      event.preventDefault();
      const tx = bx + delta[0]; const ty = by + delta[1];
      if (tx >= 0 && ty >= 0 && tx < n && ty < n) slide(ty * n + tx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, slide, tiles]);

  const record = best[size];
  return (
    <GameShell
      maxWidth={480}
      toolbar={<Segmented value={size} onChange={(next) => restart(next)} options={(['3', '4', '5'] as Size[]).map((id) => ({ id, label: `${id}×${id}` }))} />}
      stats={[
        { label: zh ? '步数' : 'Moves', value: moves },
        { label: zh ? '用时' : 'Time', value: formatGameTime(seconds) },
        { label: zh ? '最佳' : 'Best', value: record ? `${record.moves}${zh ? ' 步' : ''}` : '--' },
      ]}
      onRestart={() => restart()}
      restartLabel={zh ? '重新打乱' : 'Shuffle'}
      sound={sound}
      onToggleSound={toggleSound}
      footer={zh ? '把数字按 1、2、3… 顺序排好，空格放在右下角。点同一行或同一列的方块可以一次滑动一整排，方向键也行。' : 'Put the numbers back in order with the gap in the bottom-right. Tap any tile in the gap’s row or column to slide the line, or use the arrow keys.'}
    >
      <div className="relative mx-auto w-full max-w-[420px] rounded-2xl bg-[#24483f] p-2 shadow-lg dark:bg-[#0f1f1b]">
        <div className="relative aspect-square">
          {tiles.map((tile, index) => {
            if (!tile) return null;
            const x = index % n; const y = Math.floor(index / n);
            const home = tile === index + 1;
            return (
              <button
                key={tile}
                type="button"
                onClick={() => slide(index)}
                className={`absolute flex items-center justify-center rounded-xl font-bold shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)] transition-[left,top,background-color] duration-150 ease-out active:brightness-95 ${home ? 'bg-[#bfe8db] text-[#0d6f58]' : 'bg-[#f6faf8] text-[#24483f]'}`}
                style={{ width: `calc(${100 / n}% - 6px)`, height: `calc(${100 / n}% - 6px)`, left: `calc(${(x * 100) / n}% + 3px)`, top: `calc(${(y * 100) / n}% + 3px)`, fontSize: `clamp(16px, ${12 / n}vw, ${n === 3 ? 40 : n === 4 ? 30 : 24}px)` }}
              >
                {tile}
              </button>
            );
          })}
        </div>
        {won && <ResultBanner tone="win" title={zh ? '拼好了！' : 'Solved!'} detail={`${moves} ${zh ? '步' : 'moves'} · ${formatGameTime(seconds)}`} action={zh ? '再来一局' : 'Play again'} onAction={() => restart()} />}
      </div>
    </GameShell>
  );
};

export default SlidingPuzzleGame;
