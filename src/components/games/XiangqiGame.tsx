import React, { useMemo, useRef, useState } from 'react';
import { Maximize2, RotateCcw, Undo2, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../../i18n';
import { gameText } from '../../data/gameContent';
import { playGameTone } from './gameAudio';

type Side = 'red' | 'black';
type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'soldier';

interface Piece {
  id: string;
  side: Side;
  type: PieceType;
  label: string;
}

interface Move {
  from: number;
  to: number;
}

interface Snapshot {
  board: Board;
  turn: Side;
  lastMove: Move | null;
  winner: Side | null;
}

type Board = Array<Piece | null>;

const WIDTH = 9;
const HEIGHT = 10;
const indexOf = (x: number, y: number) => y * WIDTH + x;
const pointOf = (index: number) => ({ x: index % WIDTH, y: Math.floor(index / WIDTH) });

const piece = (id: string, side: Side, type: PieceType, label: string): Piece => ({ id, side, type, label });

const createBoard = (): Board => {
  const board: Board = Array(WIDTH * HEIGHT).fill(null);
  const backRank: Array<[PieceType, string, string]> = [
    ['rook', '车', 'r1'], ['horse', '马', 'h1'], ['elephant', '象', 'e1'], ['advisor', '士', 'a1'],
    ['general', '将', 'g'], ['advisor', '士', 'a2'], ['elephant', '象', 'e2'], ['horse', '马', 'h2'], ['rook', '车', 'r2'],
  ];
  const redRank: Array<[PieceType, string, string]> = [
    ['rook', '车', 'r1'], ['horse', '马', 'h1'], ['elephant', '相', 'e1'], ['advisor', '仕', 'a1'],
    ['general', '帅', 'g'], ['advisor', '仕', 'a2'], ['elephant', '相', 'e2'], ['horse', '马', 'h2'], ['rook', '车', 'r2'],
  ];

  backRank.forEach(([type, label, id], x) => { board[indexOf(x, 0)] = piece(`black-${id}`, 'black', type, label); });
  redRank.forEach(([type, label, id], x) => { board[indexOf(x, 9)] = piece(`red-${id}`, 'red', type, label); });
  board[indexOf(1, 2)] = piece('black-c1', 'black', 'cannon', '炮');
  board[indexOf(7, 2)] = piece('black-c2', 'black', 'cannon', '炮');
  board[indexOf(1, 7)] = piece('red-c1', 'red', 'cannon', '炮');
  board[indexOf(7, 7)] = piece('red-c2', 'red', 'cannon', '炮');
  [0, 2, 4, 6, 8].forEach((x, order) => {
    board[indexOf(x, 3)] = piece(`black-s${order}`, 'black', 'soldier', '卒');
    board[indexOf(x, 6)] = piece(`red-s${order}`, 'red', 'soldier', '兵');
  });
  return board;
};

const insidePalace = (side: Side, x: number, y: number) =>
  x >= 3 && x <= 5 && (side === 'black' ? y >= 0 && y <= 2 : y >= 7 && y <= 9);

const countBetween = (board: Board, from: number, to: number) => {
  const start = pointOf(from);
  const end = pointOf(to);
  const dx = Math.sign(end.x - start.x);
  const dy = Math.sign(end.y - start.y);
  let x = start.x + dx;
  let y = start.y + dy;
  let count = 0;
  while (x !== end.x || y !== end.y) {
    if (board[indexOf(x, y)]) count += 1;
    x += dx;
    y += dy;
  }
  return count;
};

const isPseudoLegal = (board: Board, from: number, to: number) => {
  const moving = board[from];
  const target = board[to];
  if (!moving || from === to || target?.side === moving.side) return false;

  const start = pointOf(from);
  const end = pointOf(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (moving.type === 'general') {
    if (target?.type === 'general' && start.x === end.x && countBetween(board, from, to) === 0) return true;
    return ax + ay === 1 && insidePalace(moving.side, end.x, end.y);
  }
  if (moving.type === 'advisor') return ax === 1 && ay === 1 && insidePalace(moving.side, end.x, end.y);
  if (moving.type === 'elephant') {
    const staysHome = moving.side === 'black' ? end.y <= 4 : end.y >= 5;
    if (ax !== 2 || ay !== 2 || !staysHome) return false;
    return !board[indexOf(start.x + dx / 2, start.y + dy / 2)];
  }
  if (moving.type === 'horse') {
    if (!((ax === 2 && ay === 1) || (ax === 1 && ay === 2))) return false;
    const legX = start.x + (ax === 2 ? Math.sign(dx) : 0);
    const legY = start.y + (ay === 2 ? Math.sign(dy) : 0);
    return !board[indexOf(legX, legY)];
  }
  if (moving.type === 'rook' || moving.type === 'cannon') {
    if (dx !== 0 && dy !== 0) return false;
    const between = countBetween(board, from, to);
    if (moving.type === 'rook') return between === 0;
    return target ? between === 1 : between === 0;
  }

  const forward = moving.side === 'red' ? -1 : 1;
  if (dx === 0 && dy === forward) return true;
  const crossedRiver = moving.side === 'red' ? start.y <= 4 : start.y >= 5;
  return crossedRiver && ay === 0 && ax === 1;
};

const simulateMove = (board: Board, from: number, to: number) => {
  const next = [...board];
  next[to] = next[from];
  next[from] = null;
  return next;
};

const isInCheck = (board: Board, side: Side) => {
  const generalIndex = board.findIndex((candidate) => candidate?.side === side && candidate.type === 'general');
  if (generalIndex < 0) return true;
  return board.some((candidate, from) => candidate?.side !== side && isPseudoLegal(board, from, generalIndex));
};

const isLegalMove = (board: Board, from: number, to: number, side: Side) => {
  if (board[from]?.side !== side || !isPseudoLegal(board, from, to)) return false;
  return !isInCheck(simulateMove(board, from, to), side);
};

const legalDestinations = (board: Board, from: number, side: Side) =>
  Array.from({ length: WIDTH * HEIGHT }, (_, to) => to).filter((to) => isLegalMove(board, from, to, side));

const sideHasLegalMove = (board: Board, side: Side) =>
  board.some((candidate, from) => candidate?.side === side && legalDestinations(board, from, side).length > 0);

export const XiangqiGame: React.FC = () => {
  const { language } = useI18n();
  const labels = gameText[language];
  const rootRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<Board>(createBoard);
  const [turn, setTurn] = useState<Side>('red');
  const [selected, setSelected] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [winner, setWinner] = useState<Side | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [sound, setSound] = useState(true);

  const destinations = useMemo(
    () => selected === null ? [] : legalDestinations(board, selected, turn),
    [board, selected, turn],
  );
  const checked = !winner && isInCheck(board, turn);
  const sideName = (side: Side) => side === 'red' ? labels.red : labels.black;

  const restart = () => {
    setBoard(createBoard());
    setTurn('red');
    setSelected(null);
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
    setSelected(null);
    playGameTone(sound, 300);
  };

  const choose = (index: number) => {
    if (winner) return;
    const candidate = board[index];
    if (candidate?.side === turn) {
      setSelected(index);
      playGameTone(sound, 330, 0.04);
      return;
    }
    if (selected === null || !destinations.includes(index)) return;

    setHistory((items) => [...items, { board, turn, lastMove, winner }]);
    const captured = board[index];
    const nextBoard = simulateMove(board, selected, index);
    const opponent: Side = turn === 'red' ? 'black' : 'red';
    setBoard(nextBoard);
    setLastMove({ from: selected, to: index });
    setSelected(null);
    playGameTone(sound, captured ? 620 : 460, captured ? 0.1 : 0.06);

    const capturedGeneral = captured?.type === 'general';
    if (capturedGeneral || !sideHasLegalMove(nextBoard, opponent)) {
      setWinner(turn);
      playGameTone(sound, 760, 0.2);
      return;
    }
    setTurn(opponent);
  };

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current.requestFullscreen();
  };

  return (
    <div ref={rootRef} className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-[#f5f3ed] p-3 text-gray-800 dark:bg-[#171817] dark:text-gray-100 sm:p-5">
      <div className="mx-auto flex w-full max-w-[760px] flex-wrap items-center justify-between gap-2 pb-3 text-sm">
        <div className="font-semibold">
          {winner ? `${labels.winner}: ${sideName(winner)}` : `${labels.turn}: ${sideName(turn)}`}
          {checked && <span className="ml-2 rounded bg-red-600 px-2 py-0.5 text-xs text-white">{labels.check}</span>}
        </div>
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
        <div className="relative aspect-[9/10] w-full max-w-[510px] overflow-hidden rounded-lg border-2 border-[#754c24] bg-[#ddb36f] shadow-lg dark:border-[#a97d4c] dark:bg-[#9a6c3d]">
          <div className="absolute inset-[5%]">
            <svg className="absolute inset-0 h-full w-full text-[#684019] dark:text-[#3e2917]" viewBox="0 0 8 9" preserveAspectRatio="none" aria-hidden="true">
              {Array.from({ length: 10 }, (_, y) => <line key={`h-${y}`} x1="0" y1={y} x2="8" y2={y} stroke="currentColor" strokeWidth="0.035" />)}
              <line x1="0" y1="0" x2="0" y2="9" stroke="currentColor" strokeWidth="0.045" />
              <line x1="8" y1="0" x2="8" y2="9" stroke="currentColor" strokeWidth="0.045" />
              {Array.from({ length: 7 }, (_, value) => value + 1).flatMap((x) => [
                <line key={`v-top-${x}`} x1={x} y1="0" x2={x} y2="4" stroke="currentColor" strokeWidth="0.035" />,
                <line key={`v-bottom-${x}`} x1={x} y1="5" x2={x} y2="9" stroke="currentColor" strokeWidth="0.035" />,
              ])}
              <path d="M3 0 L5 2 M5 0 L3 2 M3 7 L5 9 M5 7 L3 9" stroke="currentColor" strokeWidth="0.04" fill="none" />
            </svg>
            <div className="pointer-events-none absolute left-0 right-0 top-[45.7%] flex h-[9%] items-center justify-around text-xs font-bold tracking-[0.32em] text-[#684019]/80 dark:text-[#2f2117] sm:text-base">
              <span>楚河</span><span>汉界</span>
            </div>
            <div className="absolute inset-0 grid grid-cols-9 grid-rows-10">
              {board.map((currentPiece, index) => {
                const legal = destinations.includes(index);
                const isLast = lastMove?.from === index || lastMove?.to === index;
                return (
                  <button
                    type="button"
                    key={index}
                    data-xiangqi-index={index}
                    onClick={() => choose(index)}
                    className="relative flex min-h-0 min-w-0 items-center justify-center focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890]"
                    aria-label={currentPiece ? `${sideName(currentPiece.side)} ${currentPiece.label}` : legal ? 'legal move' : 'empty'}
                  >
                    {isLast && <span className="absolute inset-[14%] rounded-full ring-2 ring-[#17b890]" />}
                    {legal && <span className={`absolute z-10 rounded-full ${currentPiece ? 'inset-[9%] border-2 border-[#17b890]' : 'h-2.5 w-2.5 bg-[#17b890]'}`} />}
                    {currentPiece && (
                      <motion.span
                        layoutId={`xiangqi-${currentPiece.id}`}
                        transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                        className={`relative z-10 flex aspect-square w-[82%] items-center justify-center rounded-full border-2 bg-[#f7e9ce] text-sm font-bold shadow-[0_2px_4px_rgba(61,35,13,0.35)] sm:text-lg ${
                          currentPiece.side === 'red' ? 'border-[#bd3c32] text-[#b62e25]' : 'border-[#2d2925] text-[#24211e]'
                        } ${selected === index ? 'ring-2 ring-white ring-offset-2 ring-offset-[#17b890]' : ''}`}
                      >
                        {currentPiece.label}
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-[620px] text-center text-xs leading-5 text-gray-600 dark:text-gray-400">
        {language === 'zh'
          ? '标准本地双人规则：包含蹩马腿、塞象眼、炮架、过河兵、九宫和将帅照面。当前未加入电脑对手。'
          : 'Standard local two-player rules include blocked horses, elephant eyes, cannon screens, river-crossed pawns, palaces, and facing generals. No computer opponent is included yet.'}
      </p>
    </div>
  );
};
