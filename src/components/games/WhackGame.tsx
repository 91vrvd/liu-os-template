import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bomb, Play, Star } from 'lucide-react';
import { useI18n } from '../../i18n';
import { playGameTone } from './gameAudio';
import { GameShell } from './GameShell';
import { useBest, useSound } from './gameHooks';

type Kind = 'mole' | 'gold' | 'bomb';
interface Pop { kind: Kind; until: number; hit: boolean }

const ROUND = 30;
const HOLES = 9;

const Critter: React.FC<{ kind: Kind; hit: boolean }> = ({ kind, hit }) => {
  if (kind === 'bomb') return <span className="flex h-full w-full items-center justify-center rounded-full bg-[#2b2b2b] text-[#fbbf24] shadow-inner"><Bomb className="h-1/2 w-1/2" /></span>;
  const gold = kind === 'gold';
  return (
    <span className={`relative block h-full w-full rounded-t-[50%] rounded-b-[40%] ${gold ? 'bg-gradient-to-b from-[#fde68a] to-[#f59e0b]' : 'bg-gradient-to-b from-[#b08562] to-[#7c5639]'} shadow-[inset_0_-6px_0_rgba(0,0,0,0.12)]`}>
      <span className="absolute left-[24%] top-[30%] h-[12%] w-[12%] rounded-full bg-[#1f1f1f]">{hit && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white">×</span>}</span>
      <span className="absolute right-[24%] top-[30%] h-[12%] w-[12%] rounded-full bg-[#1f1f1f]" />
      <span className="absolute left-1/2 top-[48%] h-[14%] w-[22%] -translate-x-1/2 rounded-full bg-[#f7c6b0]" />
      <span className="absolute left-1/2 top-[50%] h-[6%] w-[8%] -translate-x-1/2 rounded-full bg-[#3b2a20]" />
      {gold && <Star className="absolute -right-1 -top-1 h-1/3 w-1/3 text-white" fill="currentColor" />}
    </span>
  );
};

export const WhackGame: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const [pops, setPops] = useState<(Pop | null)[]>(() => Array(HOLES).fill(null));
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(ROUND);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sound, toggleSound] = useSound();
  const [best, saveBest] = useBest<number>('liu-os-whack-best-v1', 0);
  const scoreRef = useRef(0);
  const startedAt = useRef(0);

  const start = useCallback(() => {
    setPops(Array(HOLES).fill(null));
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    setLeft(ROUND);
    setFinished(false);
    startedAt.current = performance.now();
    setRunning(true);
  }, []);

  // Spawn loop: speeds up as the round goes on.
  useEffect(() => {
    if (!running) return undefined;
    let timer = 0;
    const tick = () => {
      const elapsed = (performance.now() - startedAt.current) / 1000;
      const remaining = Math.max(0, ROUND - Math.floor(elapsed));
      setLeft(remaining);
      if (elapsed >= ROUND) {
        setRunning(false);
        setFinished(true);
        setPops(Array(HOLES).fill(null));
        if (scoreRef.current > best) saveBest(scoreRef.current);
        playGameTone(sound, 660, 0.25);
        return;
      }
      const now = performance.now();
      const pace = 1 - elapsed / (ROUND * 1.4);
      setPops((current) => {
        const next = current.map((pop) => (pop && pop.until > now ? pop : null));
        const free = next.map((pop, i) => (pop ? -1 : i)).filter((i) => i >= 0);
        const spawnCount = elapsed > ROUND * 0.6 && Math.random() < 0.45 ? 2 : 1;
        for (let k = 0; k < spawnCount && free.length; k += 1) {
          const slot = free.splice(Math.floor(Math.random() * free.length), 1)[0];
          const roll = Math.random();
          const kind: Kind = roll < 0.1 ? 'gold' : roll < 0.24 ? 'bomb' : 'mole';
          next[slot] = { kind, until: now + (kind === 'gold' ? 650 : 900 + Math.random() * 500) * pace, hit: false };
        }
        return next;
      });
      timer = window.setTimeout(tick, Math.max(260, 620 * pace));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [best, running, saveBest, sound]);

  const whack = (index: number) => {
    const pop = pops[index];
    if (!running || !pop || pop.hit || pop.until < performance.now()) {
      if (running) setCombo(0);
      return;
    }
    let delta = 0;
    if (pop.kind === 'bomb') {
      delta = -5;
      setCombo(0);
      playGameTone(sound, 140, 0.18, 'sawtooth');
      navigator.vibrate?.(40);
    } else {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      delta = (pop.kind === 'gold' ? 5 : 1) + (nextCombo >= 5 ? 1 : 0);
      playGameTone(sound, pop.kind === 'gold' ? 990 : 620 + Math.min(nextCombo, 8) * 30, 0.05);
    }
    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
    setPops((current) => current.map((item, i) => (i === index && item ? { ...item, hit: true, until: performance.now() + 220 } : item)));
  };

  return (
    <GameShell
      maxWidth={520}
      stats={[
        { label: zh ? '分数' : 'Score', value: score },
        { label: zh ? '连击' : 'Combo', value: combo },
        { label: zh ? '剩余' : 'Time', value: `${left}s` },
        { label: zh ? '最高' : 'Best', value: best },
      ]}
      onRestart={start}
      restartLabel={zh ? '重新开始' : 'Restart'}
      sound={sound}
      onToggleSound={toggleSound}
      footer={zh ? '30 秒内尽量多敲。普通 +1，金色 +5，连击 5 次以上每下多 +1；敲到炸弹 -5。' : '30 seconds. Regular +1, golden +5, +1 extra after a 5-hit combo. Bombs are -5.'}
    >
      <div className="relative mx-auto w-full max-w-[460px] rounded-3xl bg-gradient-to-b from-[#9ccf8f] to-[#6da864] p-4 shadow-lg sm:p-6">
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          {pops.map((pop, index) => {
            const visible = Boolean(pop && (pop.until > performance.now() || pop.hit));
            return (
              <button key={index} type="button" onPointerDown={(event) => { event.preventDefault(); whack(index); }} className="relative aspect-square touch-manipulation select-none" aria-label={`hole ${index + 1}`}>
                <span className="absolute inset-x-[6%] bottom-[6%] h-[34%] rounded-[50%] bg-[#3f2a1d] shadow-[inset_0_6px_10px_rgba(0,0,0,0.5)]" />
                <span className="absolute inset-x-[14%] bottom-[18%] top-[6%] overflow-hidden">
                  <span className={`absolute inset-x-0 bottom-0 h-[86%] transition-transform duration-150 ease-out ${visible ? 'translate-y-0' : 'translate-y-[110%]'} ${pop?.hit ? 'scale-90 opacity-70' : ''}`}>
                    {pop && <Critter kind={pop.kind} hit={pop.hit} />}
                  </span>
                </span>
                <span className="absolute inset-x-[4%] bottom-[4%] h-[16%] rounded-b-[50%] bg-[#5b8f52]" />
              </button>
            );
          })}
        </div>
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/25 backdrop-blur-[2px]">
            <div className="rounded-2xl bg-white/95 px-6 py-5 text-center shadow-xl dark:bg-[#1f2725]/95">
              {finished && <div className="mb-1 text-2xl font-bold text-[#0d8064] dark:text-[#78d9bf]">{score} {zh ? '分' : 'pts'}</div>}
              {finished && score >= best && score > 0 && <div className="mb-2 text-xs font-semibold text-amber-600">{zh ? '新纪录！' : 'New best!'}</div>}
              <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-md bg-[#17b890] px-5 py-2 font-semibold text-white"><Play size={16} fill="currentColor" />{finished ? (zh ? '再来一局' : 'Play again') : (zh ? '开始' : 'Start')}</button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
};

export default WhackGame;
