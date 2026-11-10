import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../i18n';
import { gameText } from '../../data/gameContent';
import { playGameTone } from './gameAudio';

type Direction = 'up' | 'right' | 'down' | 'left';
type Point = { x: number; y: number };

interface SnakeState {
  snake: Point[];
  food: Point;
  direction: Direction;
  nextDirection: Direction;
  score: number;
  highScore: number;
  running: boolean;
  paused: boolean;
  gameOver: boolean;
}

const COLS = 20;
const ROWS = 16;
const TICK_MS = 145;
const HIGH_SCORE_KEY = 'liu-os-snake-high-score-v1';

const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const opposites: Record<Direction, Direction> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const readHighScore = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(window.localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const saveHighScore = (score: number) => {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // A private browsing context may deny storage; the game still works in memory.
  }
};

const createFood = (snake: Point[]): Point => {
  const freeCells: Point[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const point = { x, y };
      if (!snake.some((segment) => samePoint(segment, point))) freeCells.push(point);
    }
  }
  return freeCells[Math.floor(Math.random() * freeCells.length)] ?? { x: 0, y: 0 };
};

const createState = (highScore = 0, running = false): SnakeState => {
  const snake = [{ x: 9, y: 8 }, { x: 8, y: 8 }, { x: 7, y: 8 }];
  return {
    snake,
    food: createFood(snake),
    direction: 'right',
    nextDirection: 'right',
    score: 0,
    highScore,
    running,
    paused: false,
    gameOver: false,
  };
};

const directionIcons: Record<Direction, LucideIcon> = {
  up: ArrowUp,
  right: ArrowRight,
  down: ArrowDown,
  left: ArrowLeft,
};

export const SnakeGame: React.FC = () => {
  const { language } = useI18n();
  const labels = gameText[language];
  const rootRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<Point | null>(null);
  const soundRef = useRef(true);
  const gameRef = useRef<SnakeState>(createState(readHighScore()));
  const [state, setState] = useState<SnakeState>(gameRef.current);
  const [sound, setSound] = useState(true);

  const commit = useCallback((next: SnakeState) => {
    gameRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const startGame = useCallback(() => {
    commit(createState(gameRef.current.highScore, true));
  }, [commit]);

  const resetGame = useCallback(() => {
    commit(createState(gameRef.current.highScore));
  }, [commit]);

  const changeDirection = useCallback((direction: Direction) => {
    const current = gameRef.current;
    if (current.gameOver || opposites[current.direction] === direction) return;
    commit({ ...current, nextDirection: direction, running: true, paused: false });
  }, [commit]);

  const togglePause = useCallback(() => {
    const current = gameRef.current;
    if (!current.running || current.gameOver) return;
    commit({ ...current, paused: !current.paused });
  }, [commit]);

  const tick = useCallback(() => {
    const current = gameRef.current;
    if (!current.running || current.paused || current.gameOver) return;

    const direction = current.nextDirection;
    const vector = vectors[direction];
    const head = current.snake[0];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const hitWall = nextHead.x < 0 || nextHead.x >= COLS || nextHead.y < 0 || nextHead.y >= ROWS;
    const ateFood = samePoint(nextHead, current.food);
    const bodyToCheck = ateFood ? current.snake : current.snake.slice(0, -1);
    const hitBody = bodyToCheck.some((segment) => samePoint(segment, nextHead));

    if (hitWall || hitBody) {
      playGameTone(soundRef.current, 170, 0.16);
      commit({ ...current, direction, nextDirection: direction, running: false, gameOver: true });
      return;
    }

    const nextSnake = [nextHead, ...current.snake];
    if (!ateFood) nextSnake.pop();
    const nextScore = current.score + (ateFood ? 10 : 0);
    const nextHighScore = Math.max(current.highScore, nextScore);
    if (nextHighScore > current.highScore) saveHighScore(nextHighScore);
    if (ateFood) playGameTone(soundRef.current, 620, 0.06);

    commit({
      ...current,
      snake: nextSnake,
      food: ateFood ? createFood(nextSnake) : current.food,
      direction,
      nextDirection: direction,
      score: nextScore,
      highScore: nextHighScore,
    });
  }, [commit]);

  useEffect(() => {
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [tick]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowRight: 'right', d: 'right', D: 'right',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
      };
      const direction = keyMap[event.key];
      if (direction) {
        event.preventDefault();
        changeDirection(direction);
      } else if (event.code === 'Space') {
        event.preventDefault();
        togglePause();
      } else if (event.key === 'Enter' && (gameRef.current.gameOver || !gameRef.current.running)) {
        event.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeDirection, startGame, togglePause]);

  const handleBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleBoardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleBoardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 18) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) changeDirection(deltaX > 0 ? 'right' : 'left');
    else changeDirection(deltaY > 0 ? 'down' : 'up');
  };

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (rootRef.current.requestFullscreen) void rootRef.current.requestFullscreen();
  };

  const isSnakeCell = (x: number, y: number) => state.snake.findIndex((segment) => segment.x === x && segment.y === y);

  return (
    <div ref={rootRef} className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-[#edf5f1] p-3 text-gray-800 dark:bg-[#141816] dark:text-gray-100 sm:p-5">
      <div className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17b890] text-white shadow-sm">
              <span className="h-4 w-4 rounded-full border-[3px] border-white/90" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0d8064] dark:text-[#78d9bf]">SNAKE / LOCAL</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {state.gameOver ? labels.snakeGameOver : state.paused ? labels.paused : state.running ? labels.snakeRunning : labels.snakeReady}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-[#e1f3ed] px-2 py-1 text-xs font-semibold text-[#0d6f58] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">{labels.snakeScore}: {state.score}</span>
            <span className="hidden rounded-md bg-[#f2b56b]/20 px-2 py-1 text-xs font-semibold text-[#8d5c24] dark:text-[#f2b56b] sm:inline-flex">{labels.snakeHighScore}: {state.highScore}</span>
            <button type="button" onClick={togglePause} disabled={!state.running || state.gameOver} className="game-icon-button" title={state.paused ? labels.resume : labels.pause} aria-label={state.paused ? labels.resume : labels.pause}>
              {state.paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button type="button" onClick={resetGame} className="game-icon-button" title={labels.restart} aria-label={labels.restart}><RotateCcw size={16} /></button>
            <button type="button" onClick={() => setSound((value) => !value)} className="game-icon-button" title={sound ? labels.soundOn : labels.soundOff} aria-label={sound ? labels.soundOn : labels.soundOff}>
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button type="button" onClick={toggleFullscreen} className="game-icon-button" title={labels.fullscreen} aria-label={labels.fullscreen}><Maximize2 size={16} /></button>
          </div>
        </div>

        <div
          role="grid"
          aria-label="Snake game board / 贪吃蛇棋盘"
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={(event) => { event.stopPropagation(); swipeStartRef.current = null; }}
          className="relative mx-auto grid aspect-[5/4] w-full max-w-[620px] select-none overflow-hidden rounded-xl border-2 border-[#9dc5bb] bg-[#dce9e5] p-2 shadow-inner touch-none dark:border-[#5e807f] dark:bg-[#1e332c]"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: COLS * ROWS }, (_, index) => {
            const x = index % COLS;
            const y = Math.floor(index / COLS);
            const snakeIndex = isSnakeCell(x, y);
            const isFood = state.food.x === x && state.food.y === y;
            const isHead = snakeIndex === 0;
            return (
              <span key={`${x}-${y}`} role="gridcell" className="flex items-center justify-center rounded-[3px] border border-[#9dc5bb]/20 dark:border-white/5">
                {snakeIndex >= 0 && <span className={`block h-[84%] w-[84%] rounded-[4px] transition-colors ${isHead ? 'bg-[#17b890] shadow-[0_0_10px_rgba(23,184,144,0.5)]' : 'bg-[#5e807f]'}`} />}
                {isFood && <span className="block h-[66%] w-[66%] rounded-full bg-[#d96c5f] shadow-[0_0_12px_rgba(217,108,95,0.45)]" />}
              </span>
            );
          })}
          {!state.running && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#082d0f]/12 p-4 backdrop-blur-[2px] dark:bg-black/25">
              <button type="button" onClick={startGame} className="inline-flex items-center gap-2 rounded-lg bg-[#17b890] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#119b78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                {state.gameOver ? <RotateCcw size={16} /> : <Play size={16} />}
                {state.gameOver ? labels.restart : labels.snakeStart}
              </button>
            </div>
          )}
          {state.paused && state.running && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20"><span className="rounded-lg bg-black/60 px-4 py-2 text-sm font-semibold text-white">{labels.paused}</span></div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          <span>{labels.snakeHint}</span>
          <span className="hidden tabular-nums sm:inline">{state.snake.length} segments</span>
        </div>

        <div className="mx-auto grid w-[164px] grid-cols-3 gap-2 sm:w-[188px]">
          <span />
          {(['up'] as Direction[]).map((direction) => {
            const Icon = directionIcons[direction];
            return <button key={direction} type="button" onClick={() => changeDirection(direction)} className="flex h-11 items-center justify-center rounded-md border border-black/10 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 active:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15" aria-label={direction}><Icon size={18} /></button>;
          })}
          {(['left'] as Direction[]).map((direction) => {
            const Icon = directionIcons[direction];
            return <button key={direction} type="button" onClick={() => changeDirection(direction)} className="flex h-11 items-center justify-center rounded-md border border-black/10 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 active:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15" aria-label={direction}><Icon size={18} /></button>;
          })}
          <button type="button" onClick={() => togglePause()} className="flex h-11 items-center justify-center rounded-md bg-[#17b890] text-white shadow-sm transition hover:bg-[#119b78] active:bg-[#0d8064] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890]" aria-label={labels.pause}><Pause size={17} /></button>
          {(['right'] as Direction[]).map((direction) => {
            const Icon = directionIcons[direction];
            return <button key={direction} type="button" onClick={() => changeDirection(direction)} className="flex h-11 items-center justify-center rounded-md border border-black/10 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 active:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15" aria-label={direction}><Icon size={18} /></button>;
          })}
          <span />
          {(['down'] as Direction[]).map((direction) => {
            const Icon = directionIcons[direction];
            return <button key={direction} type="button" onClick={() => changeDirection(direction)} className="flex h-11 items-center justify-center rounded-md border border-black/10 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 active:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15" aria-label={direction}><Icon size={18} /></button>;
          })}
          <span />
        </div>
      </div>
    </div>
  );
};
