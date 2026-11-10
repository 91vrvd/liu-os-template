import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  Bot,
  Camera,
  Cloud,
  Code2,
  Coffee,
  Compass,
  Cpu,
  Gamepad2,
  Globe2,
  Headphones,
  Lightbulb,
  Map,
  MapPin,
  Maximize2,
  Mountain,
  Music2,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  WandSparkles,
  Workflow,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../../i18n';
import { gameText } from '../../data/gameContent';
import { formatGameTime, playGameTone } from './gameAudio';

type Difficulty = 'easy' | 'medium' | 'hard';
type Theme = 'technology' | 'travel' | 'studio';

interface Card {
  id: string;
  symbol: number;
  matched: boolean;
}

interface BestScore {
  moves: number;
  seconds: number;
}

const STORAGE_KEY = 'liu-os-memory-best-v1';
const difficultyConfig: Record<Difficulty, { pairs: number; columns: number }> = {
  easy: { pairs: 6, columns: 4 },
  medium: { pairs: 8, columns: 4 },
  hard: { pairs: 12, columns: 6 },
};

const themeIcons = {
  technology: [Cpu, Bot, Code2, Cloud, Workflow, Globe2, Gamepad2, Lightbulb, Sparkles, Aperture, WandSparkles, Timer],
  travel: [Compass, Camera, MapPin, Mountain, Map, Globe2, Cloud, Coffee, Aperture, Sparkles, Headphones, Music2],
  studio: [Palette, Camera, Music2, Headphones, Aperture, Lightbulb, WandSparkles, Sparkles, Coffee, Code2, Bot, Workflow],
};

const shuffle = <T,>(values: T[]) => {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [next[index], next[random]] = [next[random], next[index]];
  }
  return next;
};

const createDeck = (pairs: number) => shuffle(
  Array.from({ length: pairs }, (_, symbol) => [
    { id: `${symbol}-a-${crypto.randomUUID()}`, symbol, matched: false },
    { id: `${symbol}-b-${crypto.randomUUID()}`, symbol, matched: false },
  ]).flat(),
);

const readBestScores = (): Record<string, BestScore> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, BestScore>;
  } catch {
    return {};
  }
};

export const MemoryGame: React.FC = () => {
  const { language } = useI18n();
  const labels = gameText[language];
  const rootRef = useRef<HTMLDivElement>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [theme, setTheme] = useState<Theme>('technology');
  const [cards, setCards] = useState<Card[]>(() => createDeck(difficultyConfig.medium.pairs));
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(true);
  const [bestScores, setBestScores] = useState<Record<string, BestScore>>(readBestScores);
  const pairCount = difficultyConfig[difficulty].pairs;
  const matchedPairs = cards.filter((card) => card.matched).length / 2;
  const completed = matchedPairs === pairCount;
  const bestKey = `${difficulty}-${theme}`;
  const best = bestScores[bestKey];
  const Icons = themeIcons[theme];

  const restart = (nextDifficulty = difficulty) => {
    setCards(createDeck(difficultyConfig[nextDifficulty].pairs));
    setOpenIds([]);
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setPaused(false);
  };

  useEffect(() => {
    if (!started || paused || completed) return undefined;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [completed, paused, started]);

  useEffect(() => {
    if (openIds.length !== 2) return undefined;
    const timeout = window.setTimeout(() => {
      setCards((current) => {
        const first = current.find((card) => card.id === openIds[0]);
        const second = current.find((card) => card.id === openIds[1]);
        if (!first || !second || first.symbol !== second.symbol) return current;
        playGameTone(sound, 680, 0.12);
        return current.map((card) => card.symbol === first.symbol ? { ...card, matched: true } : card);
      });
      setOpenIds([]);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [openIds, sound]);

  useEffect(() => {
    if (!completed || !started) return;
    const previous = bestScores[bestKey];
    const better = !previous || moves < previous.moves || (moves === previous.moves && seconds < previous.seconds);
    if (!better) return;
    const next = { ...bestScores, [bestKey]: { moves, seconds } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setBestScores(next);
    playGameTone(sound, 820, 0.24);
  }, [bestKey, bestScores, completed, moves, seconds, sound, started]);

  const flip = (card: Card) => {
    if (paused || completed || card.matched || openIds.includes(card.id) || openIds.length >= 2) return;
    if (!started) setStarted(true);
    setOpenIds((ids) => {
      const next = [...ids, card.id];
      if (next.length === 2) setMoves((value) => value + 1);
      return next;
    });
    playGameTone(sound, 440, 0.04);
  };

  const changeDifficulty = (value: Difficulty) => {
    setDifficulty(value);
    restart(value);
  };

  const changeTheme = (value: Theme) => {
    setTheme(value);
    restart(difficulty);
  };

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current.requestFullscreen();
  };

  const statusItems = useMemo(() => [
    { label: labels.moves, value: String(moves) },
    { label: labels.time, value: formatGameTime(seconds) },
    { label: labels.matched, value: `${matchedPairs}/${pairCount}` },
  ], [labels.matched, labels.moves, labels.time, matchedPairs, moves, pairCount, seconds]);

  return (
    <div ref={rootRef} className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-[#f5f8f6] p-3 text-gray-800 dark:bg-[#171817] dark:text-gray-100 sm:p-5">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-white/10">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(difficultyConfig) as Difficulty[]).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => changeDifficulty(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${difficulty === value ? 'bg-[#17b890] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-white/10 dark:text-gray-300'}`}
              >
                {labels[value]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(themeIcons) as Theme[]).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => changeTheme(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${theme === value ? 'bg-gray-900 text-white dark:bg-white dark:text-black' : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-white/10 dark:text-gray-300'}`}
              >
                {labels[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="flex gap-4 text-sm">
            {statusItems.map((item) => (
              <span key={item.label}><span className="text-gray-500 dark:text-gray-400">{item.label}</span> <strong>{item.value}</strong></span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setPaused((value) => !value)} disabled={!started || completed} className="game-control-button">
              {paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? labels.resume : labels.pause}</span>
            </button>
            <button type="button" onClick={() => restart()} className="game-icon-button" title={labels.restart}><RotateCcw size={16} /></button>
            <button type="button" onClick={() => setSound((value) => !value)} className="game-icon-button" title={sound ? labels.soundOn : labels.soundOff}>
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button type="button" onClick={toggleFullscreen} className="game-icon-button" title={labels.fullscreen}><Maximize2 size={16} /></button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[620px]">
          <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${difficultyConfig[difficulty].columns}, minmax(0, 1fr))` }}>
            {cards.map((card) => {
              const visible = card.matched || openIds.includes(card.id);
              const Icon = Icons[card.symbol];
              return (
                <button
                  type="button"
                  key={card.id}
                  data-memory-symbol={card.symbol}
                  onClick={() => flip(card)}
                  disabled={paused || completed || card.matched || openIds.length >= 2}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] disabled:cursor-default"
                  style={{ perspective: '700px' }}
                >
                  <motion.span
                    animate={{ rotateY: visible ? 180 : 0 }}
                    transition={{ duration: 0.32, ease: 'easeInOut' }}
                    className="absolute inset-0 block"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center rounded-lg border border-[#5e807f] bg-[#24483f] text-[#9dc5bb] shadow-sm" style={{ backfaceVisibility: 'hidden' }}>
                      <span className="h-6 w-6 rounded border border-current sm:h-8 sm:w-8" />
                    </span>
                    <span
                      className={`absolute inset-0 flex items-center justify-center rounded-lg border shadow-sm ${card.matched ? 'border-[#17b890] bg-[#dff2ec] text-[#0d8064]' : 'border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-[#2b2c2b] dark:text-gray-100'}`}
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
                    </span>
                  </motion.span>
                </button>
              );
            })}
          </div>

          {paused && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#f5f8f6]/90 backdrop-blur-sm dark:bg-[#171817]/90">
              <button type="button" onClick={() => setPaused(false)} className="inline-flex items-center gap-2 rounded-md bg-[#17b890] px-4 py-2 font-semibold text-white">
                <Play size={17} /> {labels.resume}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Trophy size={16} />
            {labels.best}: {best ? `${best.moves} ${labels.moves} · ${formatGameTime(best.seconds)}` : '—'}
          </span>
          {completed && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#dff2ec] px-3 py-1.5 font-semibold text-[#0d6f58] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">
              <Trophy size={16} /> {labels.completed}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
