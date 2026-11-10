import React, { useState } from 'react';
import { ArrowLeft, Bomb, CircleDot, Flag, Gamepad2, Grid3X3, Play, Shield, Swords, Rotate3D } from 'lucide-react';
import { useI18n } from '../../i18n';
import { gameCards, gameText, type GameCategory, type GameId } from '../../data/gameContent';
import { ErrorBoundary } from '../common/ErrorBoundary';

// Each game is its own chunk, so opening the Game Center (or the site) never downloads three.js etc.
const games: Record<GameId, React.LazyExoticComponent<React.FC>> = {
  chess: React.lazy(() => import('../games/XiangqiGame').then((m) => ({ default: m.XiangqiGame }))),
  snake: React.lazy(() => import('../games/SnakeGame').then((m) => ({ default: m.SnakeGame }))),
  gomoku: React.lazy(() => import('../games/GomokuGame').then((m) => ({ default: m.GomokuGame }))),
  memory: React.lazy(() => import('../games/MemoryGame').then((m) => ({ default: m.MemoryGame }))),
  cube: React.lazy(() => import('../games/CubeGame').then((m) => ({ default: m.CubeGame }))),
  mines: React.lazy(() => import('../games/MinesweeperGame')),
  breakout: React.lazy(() => import('../games/BreakoutGame')),
  sudoku: React.lazy(() => import('../games/SudokuGame')),
  slide: React.lazy(() => import('../games/SlidingPuzzleGame')),
  whack: React.lazy(() => import('../games/WhackGame')),
};

const LAST_GAME_KEY = 'liu-os-last-game';

const previewClasses: Record<GameId, string> = {
  chess: 'bg-[#d5aa67] text-[#773126]',
  snake: 'bg-[#dce9e5] text-[#0d8064]',
  gomoku: 'bg-[#d8ad67] text-[#1d1d1d]',
  memory: 'bg-[#dce9e5] text-[#0d8064]',
  cube: 'bg-[#dce8e4] text-[#0b765e]',
  mines: 'bg-[#cfe0da] text-[#24483f]',
  breakout: 'bg-[#1f2a27] text-white',
  sudoku: 'bg-[#eef3f1] text-[#24483f]',
  slide: 'bg-[#24483f] text-[#24483f]',
  whack: 'bg-[#9ccf8f] text-[#3f2a1d]',
};

const GamePreview: React.FC<{ id: GameId }> = ({ id }) => {
  if (id === 'mines') {
    const cells = ['1', '', 'f', '', '2', '1', '', 'b', '1', '', '3', 'f', '', '1', '', ''];
    return (
      <div className="grid h-20 w-20 grid-cols-4 gap-1" aria-hidden="true">
        {cells.map((cell, index) => (
          <span key={index} className={`flex items-center justify-center rounded-[4px] text-[11px] font-bold ${cell && cell !== 'f' ? 'bg-[#f3f7f5] text-[#2563eb]' : 'bg-[#6fa596]'}`}>
            {cell === 'f' ? <Flag size={10} className="text-white" fill="#f97316" /> : cell === 'b' ? <Bomb size={10} className="text-gray-700" /> : cell}
          </span>
        ))}
      </div>
    );
  }
  if (id === 'breakout') {
    return (
      <div className="relative h-20 w-32" aria-hidden="true">
        <div className="grid grid-cols-6 gap-1">{['#ef6f6c', '#f4a259', '#f6c85f', '#8cc084', '#4fb3a9', '#5b8def'].flatMap((color, row) => Array.from({ length: row < 3 ? 6 : 0 }, (_, i) => <span key={`${color}-${i}`} className="h-2.5 rounded-sm" style={{ background: ['#ef6f6c', '#f4a259', '#f6c85f'][row] }} />))}</div>
        <span className="absolute bottom-5 left-[58%] h-2.5 w-2.5 rounded-full bg-[#17b890]" />
        <span className="absolute bottom-1 left-[40%] h-2 w-10 rounded-full bg-[#e5f4ef]" />
      </div>
    );
  }
  if (id === 'sudoku') {
    const digits = '5 3 . . 7 . 6 . . 1 9 5 . 9 8 . . 6'.split(' ');
    return (
      <div className="grid h-20 w-20 grid-cols-3 border-2 border-[#24483f] bg-white text-[10px] font-bold" aria-hidden="true">
        {digits.slice(0, 9).map((digit, index) => <span key={index} className="flex items-center justify-center border border-gray-200">{digit === '.' ? '' : digit}</span>)}
      </div>
    );
  }
  if (id === 'slide') {
    return (
      <div className="grid h-20 w-20 grid-cols-3 gap-1 rounded-lg bg-[#0f1f1b] p-1" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((n) => <span key={n} className={`flex items-center justify-center rounded text-xs font-bold ${n ? 'bg-[#f6faf8] text-[#24483f]' : ''}`}>{n || ''}</span>)}
      </div>
    );
  }
  if (id === 'whack') {
    return (
      <div className="flex h-20 items-end gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="relative h-12 w-12">
            <span className="absolute inset-x-0 bottom-0 h-4 rounded-[50%] bg-[#3f2a1d]" />
            {i !== 1 && <span className={`absolute inset-x-2 bottom-2 h-8 rounded-t-full ${i === 2 ? 'bg-[#f59e0b]' : 'bg-[#9a6e4c]'}`}><span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-black" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-black" /></span>}
          </span>
        ))}
      </div>
    );
  }
  if (id === 'chess') {
    return (
      <div className="grid h-24 w-24 grid-cols-2 gap-2" aria-hidden="true">
        {['帅', '车', '将', '马'].map((label, index) => (
          <span key={label} className={`flex items-center justify-center rounded-full border-2 bg-[#f6e8cf] text-lg font-bold shadow-sm ${index < 2 ? 'border-[#bd3c32] text-[#b62e25]' : 'border-[#2d2925] text-[#24211e]'}`}>{label}</span>
        ))}
      </div>
    );
  }
  if (id === 'cube') {
    return (
      <div className="relative h-24 w-32 [perspective:420px]" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rotate-[-28deg] [transform-style:preserve-3d]">
          <span className="absolute inset-0 rounded-md border-2 border-black/15 bg-[#ee5b51] shadow-md [transform:translateZ(32px)]" />
          <span className="absolute inset-0 rounded-md border-2 border-black/15 bg-[#f5c84b] [transform:rotateY(90deg) translateZ(32px)]" />
          <span className="absolute inset-0 rounded-md border-2 border-black/15 bg-[#f7f7f2] [transform:rotateX(90deg) translateZ(32px)]" />
        </div>
        <Rotate3D size={17} className="absolute bottom-0 right-1 opacity-70" />
      </div>
    );
  }
  if (id === 'snake') {
    return (
      <div className="grid h-24 w-32 grid-cols-7 grid-rows-5 gap-1 rounded-lg bg-[#b9d6cc] p-2" aria-hidden="true">
        {Array.from({ length: 35 }, (_, index) => {
          const snakeCells = new Set([10, 11, 12, 13, 20, 27]);
          const isHead = index === 10;
          const isFood = index === 24;
          return <span key={index} className={`rounded-sm ${isFood ? 'rounded-full bg-[#d96c5f]' : snakeCells.has(index) ? (isHead ? 'bg-[#17b890]' : 'bg-[#5e807f]') : 'bg-[#eaf3ee]/70'}`} />;
        })}
      </div>
    );
  }
  if (id === 'gomoku') {
    return (
      <div className="relative h-24 w-24 border border-[#6d451f]" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(to right, rgba(74,45,18,.65) 1px, transparent 1px), linear-gradient(to bottom, rgba(74,45,18,.65) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
        <span className="absolute left-4 top-4 h-4 w-4 rounded-full bg-[#151515] shadow" />
        <span className="absolute left-8 top-8 h-4 w-4 rounded-full bg-white shadow ring-1 ring-black/20" />
        <span className="absolute left-12 top-12 h-4 w-4 rounded-full bg-[#151515] shadow" />
        <span className="absolute left-16 top-16 h-4 w-4 rounded-full bg-white shadow ring-1 ring-black/20" />
      </div>
    );
  }
  return (
    <div className="grid h-24 w-32 grid-cols-4 gap-1.5" aria-hidden="true">
      {[Gamepad2, CircleDot, Shield, Grid3X3, Swords, Gamepad2, CircleDot, Shield].map((Icon, index) => (
        <span key={index} className={`flex items-center justify-center rounded border ${index % 3 === 0 ? 'border-[#17b890] bg-white text-[#0d8064]' : 'border-[#5e807f] bg-[#24483f] text-[#9dc5bb]'}`}>
          {index % 3 === 0 && <Icon size={14} />}
        </span>
      ))}
    </div>
  );
};

export const GamesApp: React.FC = () => {
  const { language, t } = useI18n();
  const labels = gameText[language];
  const [activeGame, setActiveGameState] = useState<GameId | null>(null);
  const [category, setCategory] = useState<'all' | GameCategory>('all');
  const [lastGame, setLastGame] = useState<GameId | null>(() => {
    try { return localStorage.getItem(LAST_GAME_KEY) as GameId | null; } catch { return null; }
  });
  const selected = gameCards.find((game) => game.id === activeGame);
  const setActiveGame = (id: GameId | null) => {
    setActiveGameState(id);
    if (id) {
      setLastGame(id);
      try { localStorage.setItem(LAST_GAME_KEY, id); } catch { /* ignore */ }
    }
  };
  const ActiveGame = activeGame ? games[activeGame] : null;
  const visibleCards = gameCards.filter((game) => category === 'all' || game.category === category);
  const categories: { id: 'all' | GameCategory; zh: string; en: string }[] = [
    { id: 'all', zh: '全部', en: 'All' },
    { id: 'puzzle', zh: '益智', en: 'Puzzle' },
    { id: 'arcade', zh: '街机', en: 'Arcade' },
    { id: 'board', zh: '棋类', en: 'Board' },
  ];

  if (activeGame && selected) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-[#f5f8f6] dark:bg-[#171817]">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-black/10 bg-white/90 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#282928]/90 sm:px-4">
          <button
            type="button"
            onClick={() => setActiveGame(null)}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[#0d8064] transition-colors hover:bg-[#e3f1ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:text-[#78d9bf] dark:hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">{labels.back}</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-gray-800 dark:text-gray-100">{selected.name[language]}</h1>
          <span className="w-8 sm:w-28" aria-hidden="true" />
        </header>
        <ErrorBoundary
          key={activeGame}
          fallback={(
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f5f8f6] p-6 text-center dark:bg-[#171817] dark:text-white">
              <p className="font-semibold">{language === 'zh' ? '游戏遇到错误，请返回后重新打开。' : 'The game encountered an error. Go back and open it again.'}</p>
              <button type="button" onClick={() => setActiveGame(null)} className="rounded-md bg-[#17b890] px-4 py-2 text-sm font-semibold text-white">{labels.back}</button>
            </div>
          )}
        >
          <div className="min-h-0 flex-1">
            <React.Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-400">{language === 'zh' ? '加载中…' : 'Loading…'}</div>}>
              {ActiveGame && <ActiveGame />}
            </React.Suspense>
          </div>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f5f8f6] text-gray-900 dark:bg-[#1c1c1c] dark:text-white">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#282928]/90 sm:px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17b890] text-white shadow-sm">
          <Gamepad2 size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold">{t('games.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{language === 'zh' ? `${gameCards.length} 款小游戏，不用联网，电脑手机都能玩` : `${gameCards.length} offline games for desktop and phone`}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-black/5 p-0.5 dark:bg-white/10">
          {categories.map((item) => (
            <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${category === item.id ? 'bg-white text-gray-900 shadow-sm dark:bg-white/20 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}>{language === 'zh' ? item.zh : item.en}</button>
          ))}
        </div>
      </header>

      <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {lastGame && category === 'all' && gameCards.some((game) => game.id === lastGame) && (
          <button type="button" onClick={() => setActiveGame(lastGame)} className="mx-auto mb-3 flex w-full max-w-5xl items-center gap-3 rounded-xl border border-[#9dc5bb] bg-[#e1f3ed] px-4 py-2.5 text-left text-sm text-[#0d6f58] transition hover:brightness-[0.98] dark:border-[#2f6b5b] dark:bg-[#17b890]/10 dark:text-[#78d9bf]">
            <Play size={14} fill="currentColor" />
            <span className="flex-1">{language === 'zh' ? '继续玩：' : 'Continue: '}<b>{gameCards.find((game) => game.id === lastGame)?.name[language]}</b></span>
          </button>
        )}
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {visibleCards.map((game) => (
            <button
              type="button"
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className="group flex overflow-hidden rounded-xl border border-black/10 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#9dc5bb] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-[#282928] dark:hover:border-[#5e807f] sm:flex-col"
            >
              <div className={`flex w-28 shrink-0 items-center justify-center border-r border-black/10 dark:border-white/10 sm:aspect-[16/6] sm:w-auto sm:border-b sm:border-r-0 ${previewClasses[game.id]}`}>
                <div className="origin-center scale-[0.7] transition-transform duration-300 group-hover:scale-[0.75] sm:scale-90 sm:group-hover:scale-95">
                  <GamePreview id={game.id} />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-[15px] font-bold sm:text-base">{game.name[language]}</h2>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e1f3ed] px-2 py-0.5 text-[11px] font-semibold text-[#0d6f58] opacity-90 transition group-hover:opacity-100 dark:bg-[#17b890]/15 dark:text-[#78d9bf]">
                    <Play size={11} /> {labels.play}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-gray-600 dark:text-gray-400">{game.description[language]}</p>
                <p className="mt-auto pt-2 text-[11px] text-gray-500 dark:text-gray-500">{game.controls[language]}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};
