import React, { useRef, useState } from 'react';
import { Maximize2, RotateCcw, Undo2, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../../i18n';
import { gameText } from '../../data/gameContent';
import { playGameTone } from './gameAudio';

type Stone = 'black' | 'white';
type Winner = Stone | 'draw' | null;

interface Snapshot {
  board: Array<Stone | null>;
  turn: Stone;
  lastMove: number | null;
  winner: Winner;
}

const SIZE = 15;

const isWinningMove = (board: Array<Stone | null>, index: number, stone: Stone) => {
  const x = index % SIZE;
  const y = Math.floor(index / SIZE);
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const count = (dx: number, dy: number) => {
    let total = 0;
    let nextX = x + dx;
    let nextY = y + dy;
    while (nextX >= 0 && nextX < SIZE && nextY >= 0 && nextY < SIZE && board[nextY * SIZE + nextX] === stone) {
      total += 1;
      nextX += dx;
      nextY += dy;
    }
    return total;
  };
  return directions.some(([dx, dy]) => 1 + count(dx, dy) + count(-dx, -dy) >= 5);
};

export const GomokuGame: React.FC = () => {
  const { language } = useI18n();
  const labels = gameText[language];
  const rootRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<Array<Stone | null>>(() => Array(SIZE * SIZE).fill(null));
  const [turn, setTurn] = useState<Stone>('black');
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [winner, setWinner] = useState<Winner>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [sound, setSound] = useState(true);

  const name = (stone: Stone) => stone === 'black' ? labels.black : labels.white;
  const moveCount = board.filter(Boolean).length;

  const restart = () => {
    setBoard(Array(SIZE * SIZE).fill(null));
    setTurn('black');
    setLastMove(null);
    setWinner(null);
    setHistory([]);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setBoard(previous.board);
    setTurn(previous.turn);
    setLastMove(previous.lastMove);
    setWinner(previous.winner);
    setHistory((items) => items.slice(0, -1));
    playGameTone(sound, 300);
  };

  const place = (index: number) => {
    if (board[index] || winner) return;
    setHistory((items) => [...items, { board, turn, lastMove, winner }]);
    const next = [...board];
    next[index] = turn;
    setBoard(next);
    setLastMove(index);
    playGameTone(sound, turn === 'black' ? 410 : 520);
    if (isWinningMove(next, index, turn)) {
      setWinner(turn);
      playGameTone(sound, 760, 0.2);
      return;
    }
    if (next.every(Boolean)) {
      setWinner('draw');
      return;
    }
    setTurn(turn === 'black' ? 'white' : 'black');
  };

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current.requestFullscreen();
  };

  const status = winner === 'draw'
    ? (language === 'zh' ? '棋盘已满，平局' : 'The board is full: draw')
    : winner
      ? `${labels.winner}: ${name(winner)}`
      : `${labels.turn}: ${name(turn)}`;

  return (
    <div ref={rootRef} className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-[#f3f2ee] p-3 text-gray-800 dark:bg-[#171817] dark:text-gray-100 sm:p-5">
      <div className="mx-auto flex w-full max-w-[760px] flex-wrap items-center justify-between gap-2 pb-3 text-sm">
        <div className="font-semibold">{status} <span className="ml-2 text-gray-500 dark:text-gray-400">{labels.moves}: {moveCount}</span></div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={undo} disabled={history.length === 0} className="game-control-button" title={labels.undo}>
            <Undo2 size={15} /><span>{labels.undo}</span>
          </button>
          <button type="button" onClick={restart} className="game-control-button" title={labels.restart}>
            <RotateCcw size={15} /><span>{labels.restart}</span>
          </button>
          <button type="button" onClick={() => setSound((value) => !value)} className="game-icon-button" title={sound ? labels.soundOn : labels.soundOff}>
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button type="button" onClick={toggleFullscreen} className="game-icon-button" title={labels.fullscreen}>
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[760px] flex-1 items-center justify-center">
        <div className="relative aspect-square w-full max-w-[560px] overflow-hidden rounded-lg border-2 border-[#7b5228] bg-[#d9ae68] shadow-lg dark:border-[#a77a49] dark:bg-[#95663a]">
          <div
            className="absolute inset-[5.5%]"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(74,45,18,.72) 1px, transparent 1px), linear-gradient(to bottom, rgba(74,45,18,.72) 1px, transparent 1px)',
              backgroundSize: 'calc(100% / 14) calc(100% / 14)',
            }}
          >
            {[3, 7, 11].flatMap((x) => [3, 7, 11].map((y) => (
              <span
                key={`${x}-${y}`}
                className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4a2d12]"
                style={{ left: `${(x / 14) * 100}%`, top: `${(y / 14) * 100}%` }}
              />
            )))}
            <div className="absolute inset-0 grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))]">
              {board.map((stone, index) => (
                <button
                  type="button"
                  key={index}
                  data-gomoku-index={index}
                  onClick={() => place(index)}
                  disabled={Boolean(stone || winner)}
                  aria-label={stone ? `${name(stone)} stone` : 'empty intersection'}
                  className="relative flex min-h-0 min-w-0 items-center justify-center rounded-full hover:bg-white/15 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] disabled:cursor-default"
                >
                  {stone && (
                    <motion.span
                      initial={{ scale: 0.65, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.16 }}
                      className={`relative h-[76%] w-[76%] rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.4)] ${
                        stone === 'black' ? 'bg-[#151515] ring-1 ring-white/20' : 'bg-[#f7f5ee] ring-1 ring-black/25'
                      }`}
                    >
                      {lastMove === index && <span className={`absolute inset-[36%] rounded-full ${stone === 'black' ? 'bg-white' : 'bg-[#d96c5f]'}`} />}
                    </motion.span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-[560px] text-center text-xs leading-5 text-gray-600 dark:text-gray-400">
        {language === 'zh' ? '本地双人自由规则，黑方先行；目前不启用职业比赛中的禁手规则。' : 'Local two-player freestyle rules with Black moving first. Professional forbidden-move rules are not enabled.'}
      </p>
    </div>
  );
};
