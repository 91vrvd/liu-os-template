import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useI18n } from '../../i18n';
import { playGameTone } from './gameAudio';
import { GameShell, ResultBanner } from './GameShell';
import { useBest, useSound } from './gameHooks';

const W = 480;
const H = 560;
const COLS = 8;
const PADDLE_Y = H - 36;
const BRICK_COLORS = ['#ef6f6c', '#f4a259', '#f6c85f', '#8cc084', '#4fb3a9', '#5b8def', '#9b7fe6'];

interface Brick { x: number; y: number; w: number; h: number; hp: number; color: string }
interface World {
  paddleX: number; paddleW: number;
  ball: { x: number; y: number; vx: number; vy: number; r: number; stuck: boolean };
  bricks: Brick[];
  score: number; lives: number; level: number;
}

const buildBricks = (level: number): Brick[] => {
  const rows = Math.min(4 + level, 9);
  const gap = 6;
  const w = (W - 24 - gap * (COLS - 1)) / COLS;
  const bricks: Brick[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      // Later levels leave a few gaps and add tougher bricks.
      if (level > 1 && (row * 7 + col * 3 + level) % 11 === 0) continue;
      const hp = level > 2 && row < Math.floor(level / 2) ? 2 : 1;
      bricks.push({ x: 12 + col * (w + gap), y: 64 + row * 26, w, h: 18, hp, color: BRICK_COLORS[row % BRICK_COLORS.length] });
    }
  }
  return bricks;
};

const newWorld = (level = 1, score = 0, lives = 3): World => ({
  paddleX: W / 2, paddleW: Math.max(64, 96 - (level - 1) * 6),
  ball: { x: W / 2, y: PADDLE_Y - 10, vx: 0, vy: 0, r: 7, stuck: true },
  bricks: buildBricks(level), score, lives, level,
});

export const BreakoutGame: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(newWorld());
  const keysRef = useRef({ left: false, right: false });
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1 });
  const [status, setStatus] = useState<'ready' | 'playing' | 'paused' | 'over'>('ready');
  const statusRef = useRef(status);
  const [sound, toggleSound] = useSound();
  const soundRef = useRef(sound);
  const [best, saveBest] = useBest<number>('liu-os-breakout-best-v1', 0);
  statusRef.current = status;
  soundRef.current = sound;
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(480);

  // Fit the board inside the window: limited by both the available width and height.
  useEffect(() => {
    const box = boxRef.current;
    const scroller = box?.closest('.custom-scrollbar') as HTMLElement | null;
    if (!box || !scroller) return undefined;
    const fit = () => {
      const availableHeight = scroller.clientHeight - 150;
      const availableWidth = (box.parentElement?.clientWidth ?? 480);
      setBoxWidth(Math.max(220, Math.min(480, availableWidth, (availableHeight * W) / H)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const launch = useCallback(() => {
    const { ball, level } = worldRef.current;
    if (!ball.stuck) return;
    const speed = 5.2 + level * 0.45;
    const angle = (-Math.PI / 2) + (Math.random() * 0.8 - 0.4);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.stuck = false;
    setStatus('playing');
  }, []);

  const restart = () => {
    worldRef.current = newWorld();
    setHud({ score: 0, lives: 3, level: 1 });
    setStatus('ready');
  };

  // Paddle follows the pointer (mouse or finger) across the canvas.
  const movePaddle = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const world = worldRef.current;
    world.paddleX = Math.max(world.paddleW / 2, Math.min(W - world.paddleW / 2, x));
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(event.key)) keysRef.current.left = true;
      if (['ArrowRight', 'd', 'D'].includes(event.key)) keysRef.current.right = true;
      if (event.key === ' ' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (statusRef.current === 'playing' && !worldRef.current.ball.stuck) setStatus('paused');
        else if (statusRef.current === 'paused') setStatus('playing');
        else if (statusRef.current !== 'over') launch();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(event.key)) keysRef.current.left = false;
      if (['ArrowRight', 'd', 'D'].includes(event.key)) keysRef.current.right = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [launch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    context.scale(dpr, dpr);
    let frame = 0;
    let last = performance.now();
    const dark = () => document.documentElement.classList.contains('dark');

    const step = (dt: number) => {
      const world = worldRef.current;
      const { ball } = world;
      const paddleSpeed = 9 * dt;
      if (keysRef.current.left) world.paddleX = Math.max(world.paddleW / 2, world.paddleX - paddleSpeed);
      if (keysRef.current.right) world.paddleX = Math.min(W - world.paddleW / 2, world.paddleX + paddleSpeed);
      if (ball.stuck) { ball.x = world.paddleX; ball.y = PADDLE_Y - ball.r - 1; return; }
      if (statusRef.current !== 'playing') return;
      // Sub-steps keep the fast ball from tunnelling through bricks.
      const sub = 3;
      for (let i = 0; i < sub; i += 1) {
        ball.x += (ball.vx * dt) / sub;
        ball.y += (ball.vy * dt) / sub;
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
        const half = world.paddleW / 2;
        if (ball.vy > 0 && ball.y + ball.r >= PADDLE_Y && ball.y + ball.r <= PADDLE_Y + 14 && ball.x >= world.paddleX - half - ball.r && ball.x <= world.paddleX + half + ball.r) {
          const hit = (ball.x - world.paddleX) / half;
          const speed = Math.hypot(ball.vx, ball.vy);
          const angle = (-Math.PI / 2) + hit * 1.05;
          ball.vx = Math.cos(angle) * speed;
          ball.vy = Math.sin(angle) * speed;
          ball.y = PADDLE_Y - ball.r;
          playGameTone(soundRef.current, 300, 0.03);
        }
        for (const brick of world.bricks) {
          if (brick.hp <= 0) continue;
          const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
          const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
          const dx = ball.x - nearestX; const dy = ball.y - nearestY;
          if (dx * dx + dy * dy > ball.r * ball.r) continue;
          if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
          else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
          brick.hp -= 1;
          world.score += brick.hp <= 0 ? 10 * world.level : 5;
          playGameTone(soundRef.current, brick.hp <= 0 ? 660 : 480, 0.04);
          break;
        }
        if (ball.y > H + ball.r) {
          world.lives -= 1;
          playGameTone(soundRef.current, 160, 0.25, 'triangle');
          if (world.lives <= 0) {
            setStatus('over');
            if (world.score > best) saveBest(world.score);
          } else {
            ball.stuck = true;
            setStatus('ready');
          }
          break;
        }
      }
      if (world.bricks.every((brick) => brick.hp <= 0)) {
        playGameTone(soundRef.current, 990, 0.2);
        worldRef.current = newWorld(world.level + 1, world.score, Math.min(world.lives + 1, 5));
        setStatus('ready');
      }
      setHud((current) => (current.score === world.score && current.lives === world.lives && current.level === world.level ? current : { score: world.score, lives: world.lives, level: world.level }));
    };

    const draw = () => {
      const world = worldRef.current;
      const isDark = dark();
      context.clearRect(0, 0, W, H);
      context.fillStyle = isDark ? '#1f2a27' : '#eef5f2';
      context.fillRect(0, 0, W, H);
      for (const brick of world.bricks) {
        if (brick.hp <= 0) continue;
        context.fillStyle = brick.color;
        context.globalAlpha = brick.hp > 1 ? 1 : 0.88;
        context.beginPath();
        context.roundRect(brick.x, brick.y, brick.w, brick.h, 5);
        context.fill();
        if (brick.hp > 1) { context.strokeStyle = isDark ? '#fff' : '#1f2937'; context.lineWidth = 2; context.stroke(); }
      }
      context.globalAlpha = 1;
      context.fillStyle = isDark ? '#e5f4ef' : '#24483f';
      context.beginPath();
      context.roundRect(world.paddleX - world.paddleW / 2, PADDLE_Y, world.paddleW, 12, 6);
      context.fill();
      context.fillStyle = '#17b890';
      context.beginPath();
      context.arc(world.ball.x, world.ball.y, world.ball.r, 0, Math.PI * 2);
      context.fill();
      if (statusRef.current === 'ready') {
        context.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
        context.font = '600 16px -apple-system, system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillText(zh ? '点击或按空格发球' : 'Tap or press Space to launch', W / 2, H / 2 + 40);
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(2.5, (now - last) / 16.67);
      last = now;
      step(dt);
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [best, saveBest, zh]);

  return (
    <GameShell
      maxWidth={520}
      stats={[
        { label: zh ? '分数' : 'Score', value: hud.score },
        { label: zh ? '生命' : 'Lives', value: '♥'.repeat(Math.max(0, hud.lives)) || '0' },
        { label: zh ? '关卡' : 'Level', value: hud.level },
        { label: zh ? '最高' : 'Best', value: best },
      ]}
      onRestart={restart}
      restartLabel={zh ? '重新开始' : 'Restart'}
      sound={sound}
      onToggleSound={toggleSound}
      extraButtons={<button type="button" disabled={status === 'ready' || status === 'over'} onClick={() => setStatus((value) => (value === 'paused' ? 'playing' : 'paused'))} className="game-icon-button" aria-label={status === 'paused' ? 'Resume' : 'Pause'}>{status === 'paused' ? <Play size={16} /> : <Pause size={16} />}</button>}
      footer={zh ? '鼠标或手指左右移动挡板，← → / A D 也可以；空格暂停。打掉所有砖块进入下一关，每关奖励一条命。' : 'Move the paddle with mouse, finger, ← → or A D. Space pauses. Clear every brick for the next level and a bonus life.'}
    >
      <div ref={boxRef} className="relative mx-auto overflow-hidden rounded-xl shadow-inner" style={{ width: boxWidth, aspectRatio: `${W} / ${H}`, touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onPointerMove={(event) => movePaddle(event.clientX)}
          onPointerDown={(event) => { movePaddle(event.clientX); if (status === 'ready') launch(); }}
        />
        {status === 'paused' && <ResultBanner tone="win" title={zh ? '已暂停' : 'Paused'} action={zh ? '继续' : 'Resume'} onAction={() => setStatus('playing')} />}
        {status === 'over' && <ResultBanner tone="lose" title={zh ? '游戏结束' : 'Game over'} detail={`${zh ? '得分' : 'Score'} ${hud.score}`} action={zh ? '再来一局' : 'Play again'} onAction={restart} />}
      </div>
    </GameShell>
  );
};

export default BreakoutGame;
