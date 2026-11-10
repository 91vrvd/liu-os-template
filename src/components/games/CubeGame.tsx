import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Maximize2, Minimize2, RotateCcw, Shuffle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { gameText } from '../../data/gameContent';

type CubeFace = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';
type CubeAxis = 'x' | 'y' | 'z';

type Cubie = THREE.Group & {
  userData: {
    coord: { x: number; y: number; z: number };
    home: { x: number; y: number; z: number };
  };
};

type CubeMove = {
  face: CubeFace;
  axis: CubeAxis;
  layer: number;
  direction: 1 | -1;
};

const CUBIE_SPACING = 1.02;
const TURN_DURATION = 220;

const FACE_CONFIG: Record<CubeFace, CubeMove> = {
  U: { face: 'U', axis: 'y', layer: 1, direction: -1 },
  D: { face: 'D', axis: 'y', layer: -1, direction: 1 },
  L: { face: 'L', axis: 'x', layer: -1, direction: 1 },
  R: { face: 'R', axis: 'x', layer: 1, direction: -1 },
  F: { face: 'F', axis: 'z', layer: 1, direction: -1 },
  B: { face: 'B', axis: 'z', layer: -1, direction: 1 },
};

const STICKER_COLORS = {
  U: '#f7f7f2',
  D: '#f3ce4e',
  F: '#29b98a',
  B: '#3f88dc',
  R: '#ed6257',
  L: '#f18b49',
};

const faceButtons: CubeFace[] = ['U', 'D', 'L', 'R', 'F', 'B'];

const easeInOutCubic = (value: number) => (
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
);

const addSticker = (cubie: Cubie, normal: THREE.Vector3, face: CubeFace) => {
  const geometry = new THREE.PlaneGeometry(0.82, 0.82);
  const material = new THREE.MeshStandardMaterial({
    color: STICKER_COLORS[face],
    roughness: 0.75,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const sticker = new THREE.Mesh(geometry, material);
  sticker.position.copy(normal.clone().multiplyScalar(0.49));
  sticker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  sticker.userData.face = face;
  cubie.add(sticker);
};

const createCubie = (x: number, y: number, z: number) => {
  const cubie = new THREE.Group() as Cubie;
  cubie.position.set(x * CUBIE_SPACING, y * CUBIE_SPACING, z * CUBIE_SPACING);
  cubie.userData.coord = { x, y, z };
  cubie.userData.home = { x, y, z };

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.96, 0.96),
    new THREE.MeshStandardMaterial({ color: '#18231f', roughness: 0.82, metalness: 0.05 }),
  );
  cubie.add(core);

  if (y === 1) addSticker(cubie, new THREE.Vector3(0, 1, 0), 'U');
  if (y === -1) addSticker(cubie, new THREE.Vector3(0, -1, 0), 'D');
  if (z === 1) addSticker(cubie, new THREE.Vector3(0, 0, 1), 'F');
  if (z === -1) addSticker(cubie, new THREE.Vector3(0, 0, -1), 'B');
  if (x === 1) addSticker(cubie, new THREE.Vector3(1, 0, 0), 'R');
  if (x === -1) addSticker(cubie, new THREE.Vector3(-1, 0, 0), 'L');

  return cubie;
};

const buildCube = (root: THREE.Group) => {
  const cubies: Cubie[] = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const cubie = createCubie(x, y, z);
        root.add(cubie);
        cubies.push(cubie);
      }
    }
  }
  return cubies;
};

const rotateCoordinate = (coord: { x: number; y: number; z: number }, axis: CubeAxis, direction: 1 | -1) => {
  const turns = direction === 1 ? 1 : 3;
  for (let index = 0; index < turns; index += 1) {
    if (axis === 'x') {
      const nextY = -coord.z;
      coord.z = coord.y;
      coord.y = nextY;
    } else if (axis === 'y') {
      const nextX = coord.z;
      coord.z = -coord.x;
      coord.x = nextX;
    } else {
      const nextX = -coord.y;
      coord.y = coord.x;
      coord.x = nextX;
    }
  }
};

const isSolved = (cubies: Cubie[]) => {
  const identity = new THREE.Quaternion();
  return cubies.every((cubie) => {
    const { coord, home } = cubie.userData;
    const atHome = coord.x === home.x && coord.y === home.y && coord.z === home.z;
    return atHome && cubie.quaternion.angleTo(identity) < 0.025;
  });
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
};

export const CubeGame: React.FC = () => {
  const { language } = useI18n();
  const labels = gameText[language];
  const viewportRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const cubiesRef = useRef<Cubie[]>([]);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const setBusyState = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

  useEffect(() => {
    mountedRef.current = true;
    const host = viewportRef.current;
    if (!host) return () => undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(4.7, 4.1, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D Rubik cube / 可操作的 3D 魔方');
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'grab';

    const ambient = new THREE.AmbientLight('#ffffff', 2.3);
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.2);
    keyLight.position.set(4, 6, 7);
    scene.add(ambient, keyLight);

    const root = new THREE.Group();
    root.rotation.set(0.18, -0.42, 0.06);
    scene.add(root);
    rootRef.current = root;
    cubiesRef.current = buildCube(root);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.7;
    controls.maxDistance = 9;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.target.set(0, 0, 0);

    // The OS window is draggable as a whole. Keep canvas gestures inside the cube.
    const stopWindowDrag = (event: Event) => {
      event.stopPropagation();
    };
    renderer.domElement.addEventListener('pointerdown', stopWindowDrag);
    renderer.domElement.addEventListener('mousedown', stopWindowDrag);
    renderer.domElement.addEventListener('touchstart', stopWindowDrag, { passive: false });

    const onControlStart = () => {
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onControlEnd = () => {
      renderer.domElement.style.cursor = 'grab';
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      mountedRef.current = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', stopWindowDrag);
      renderer.domElement.removeEventListener('mousedown', stopWindowDrag);
      renderer.domElement.removeEventListener('touchstart', stopWindowDrag);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();
      disposeObject(root);
      renderer.dispose();
      renderer.domElement.remove();
      rootRef.current = null;
      cubiesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const animateMove = useCallback((move: CubeMove) => new Promise<void>((resolve) => {
    const root = rootRef.current;
    const cubies = cubiesRef.current;
    if (!root || !cubies.length) {
      resolve();
      return;
    }

    const selected = cubies.filter((cubie) => cubie.userData.coord[move.axis] === move.layer);
    const turnGroup = new THREE.Group();
    root.add(turnGroup);
    selected.forEach((cubie) => turnGroup.attach(cubie));

    const start = performance.now();
    const target = move.direction * Math.PI / 2;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / TURN_DURATION, 1);
      turnGroup.rotation[move.axis] = target * easeInOutCubic(progress);
      if (progress < 1) {
        window.requestAnimationFrame(tick);
        return;
      }

      selected.forEach((cubie) => {
        rotateCoordinate(cubie.userData.coord, move.axis, move.direction);
        root.attach(cubie);
        cubie.position.set(
          cubie.userData.coord.x * CUBIE_SPACING,
          cubie.userData.coord.y * CUBIE_SPACING,
          cubie.userData.coord.z * CUBIE_SPACING,
        );
      });
      root.remove(turnGroup);
      resolve();
    };
    window.requestAnimationFrame(tick);
  }), []);

  const runMove = useCallback(async (face: CubeFace, inverse = false, countMove = true) => {
    if (busyRef.current) return;
    setBusyState(true);
    const base = FACE_CONFIG[face];
    const move = inverse ? { ...base, direction: base.direction === 1 ? -1 : 1 } as CubeMove : base;
    await animateMove(move);
    if (mountedRef.current) {
      if (countMove) setMoves((value) => value + 1);
      setSolved(isSolved(cubiesRef.current));
    }
    setBusyState(false);
  }, [animateMove]);

  const scramble = useCallback(async () => {
    if (busyRef.current) return;
    setBusyState(true);
    const faces = faceButtons.slice();
    let previousAxis: CubeAxis | null = null;
    for (let index = 0; index < 18; index += 1) {
      const options = faces.filter((face) => FACE_CONFIG[face].axis !== previousAxis);
      const face = options[Math.floor(Math.random() * options.length)];
      previousAxis = FACE_CONFIG[face].axis;
      await animateMove(FACE_CONFIG[face]);
    }
    if (mountedRef.current) {
      setMoves(0);
      setSolved(false);
    }
    setBusyState(false);
  }, [animateMove]);

  const reset = useCallback(() => {
    if (busyRef.current || !rootRef.current) return;
    disposeObject(rootRef.current);
    rootRef.current.clear();
    cubiesRef.current = buildCube(rootRef.current);
    setMoves(0);
    setSolved(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toUpperCase() as CubeFace;
      if (!faceButtons.includes(key)) return;
      event.preventDefault();
      void runMove(key, event.shiftKey);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runMove]);

  const openFullscreen = () => {
    const element = viewportRef.current;
    if (!element) return;
    if (focusMode || document.fullscreenElement) {
      setFocusMode(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      return;
    }
    setFocusMode(true);
    if (element.requestFullscreen) void element.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f8f6] dark:bg-[#171817]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white/75 px-3 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-[#222522]/80 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-[#0d8064] dark:text-[#78d9bf]">Rubik / 3D</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{solved ? labels.cubeSolved : labels.cubeViewHint}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-[#e1f3ed] px-2 py-1 text-xs font-semibold text-[#0d6f58] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">{labels.cubeMoves}: {moves}</span>
          <button type="button" onClick={() => void scramble()} disabled={busy} title={labels.cubeScramble} aria-label={labels.cubeScramble} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-[#0d8064] disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-300 dark:hover:bg-white/10">
            <Shuffle size={16} />
          </button>
          <button type="button" onClick={reset} disabled={busy} title={labels.cubeReset} aria-label={labels.cubeReset} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-[#0d8064] disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-300 dark:hover:bg-white/10">
            <RotateCcw size={16} />
          </button>
          <button type="button" onClick={openFullscreen} title={focusMode ? labels.exitFullscreen : labels.fullscreen} aria-label={focusMode ? labels.exitFullscreen : labels.fullscreen} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-[#0d8064] dark:text-slate-300 dark:hover:bg-white/10">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className={focusMode ? 'fixed inset-0 z-50 overflow-hidden bg-[#f5f8f6] p-0 dark:bg-[#171817]' : 'min-h-0 flex-1 overflow-y-auto p-3 sm:p-5'}>
        <div className={focusMode ? 'h-full w-full' : 'mx-auto flex min-h-full max-w-4xl flex-col gap-3'}>
          <div ref={viewportRef} className={focusMode ? 'relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(23,184,144,0.18),transparent_48%),linear-gradient(145deg,#eef5f1,#dbe9e4)] fullscreen:h-screen fullscreen:w-screen dark:bg-[radial-gradient(circle_at_50%_35%,rgba(23,184,144,0.18),transparent_48%),linear-gradient(145deg,#24342f,#111613)]' : 'relative h-[clamp(280px,52vh,520px)] min-h-[280px] shrink-0 overflow-hidden rounded-xl border border-[#9dc5bb]/60 bg-[radial-gradient(circle_at_50%_35%,rgba(23,184,144,0.18),transparent_48%),linear-gradient(145deg,#eef5f1,#dbe9e4)] shadow-inner fullscreen:h-screen fullscreen:min-h-0 fullscreen:w-screen fullscreen:rounded-none fullscreen:border-0 fullscreen:shadow-none dark:border-white/10 dark:bg-[radial-gradient(circle_at_50%_35%,rgba(23,184,144,0.18),transparent_48%),linear-gradient(145deg,#24342f,#111613)]'}>
            {focusMode && (
              <button type="button" onClick={openFullscreen} title={labels.exitFullscreen} aria-label={labels.exitFullscreen} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Minimize2 size={18} />
              </button>
            )}
          </div>
          {!focusMode && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            <span>{busy ? labels.cubeBusy : labels.cubeReady}</span>
            <span>{labels.cubeViewHint}</span>
          </div>}
          {!focusMode && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {faceButtons.map((face) => (
              <div key={face} className="flex items-center gap-1 rounded-lg border border-black/10 bg-white/70 p-1.5 dark:border-white/10 dark:bg-white/5">
                <span className="w-7 text-center text-sm font-bold text-slate-700 dark:text-slate-200">{face}</span>
                <button type="button" onClick={() => void runMove(face)} disabled={busy} className="flex h-9 flex-1 items-center justify-center rounded-md bg-[#17b890] text-sm font-semibold text-white transition hover:bg-[#119b78] disabled:cursor-not-allowed disabled:opacity-45" aria-label={`${face} clockwise`}>
                  ↻
                </button>
                <button type="button" onClick={() => void runMove(face, true)} disabled={busy} className="flex h-9 flex-1 items-center justify-center rounded-md border border-[#9dc5bb] text-sm font-semibold text-[#0d8064] transition hover:bg-[#e4f2ed] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#5e807f] dark:text-[#78d9bf] dark:hover:bg-white/10" aria-label={`${face} counterclockwise`}>
                  ↺
                </button>
              </div>
            ))}
          </div>}
          {!focusMode && <p className="pb-1 text-center text-[11px] text-slate-400">U D L R F B · Shift + key reverses the turn</p>}
        </div>
      </div>
    </div>
  );
};
