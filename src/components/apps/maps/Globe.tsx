import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { solarPosition, type Place } from './model';
import { assetUrl } from '../../../lib/assetUrl';
import { desiredResolution, textureLimit, type TextureResolution } from './textureQuality';

const position = (lat: number, lng: number, radius = 1) => {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
};

export default function Globe({ places, selected, onSelect, label, fallback }: { places: Place[]; selected: Place | null; onSelect: (place: Place) => void; label: string; fallback: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const state = useRef<{ pins: THREE.Group; camera: THREE.PerspectiveCamera; controls: OrbitControls; target: THREE.Vector3 | null }>();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); } catch { setFailed(true); return; }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.copy(position(22, 100, 3.5));
    const compact = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.75 : 2));
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 1.65;
    controls.maxDistance = 5;
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotateSpeed = 0.23;
    controls.addEventListener('start', () => { controls.autoRotate = false; if (state.current) state.current.target = null; });
    const texture = new THREE.TextureLoader().load(assetUrl('maps/earth.jpg'));
    texture.colorSpace = THREE.SRGBColorSpace;
    const night = new THREE.TextureLoader().load(assetUrl('maps/earth-night.png'));
    night.colorSpace = THREE.SRGBColorSpace;
    const uniforms = { dayMap: { value: texture }, nightMap: { value: night }, sunDirection: { value: new THREE.Vector3() } };
    const hardware = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
    const limit = textureLimit({ maxTextureSize: renderer.capabilities.maxTextureSize, compact, memory: hardware.deviceMemory, saveData: hardware.connection?.saveData, connection: hardware.connection?.effectiveType });
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.anisotropy = night.anisotropy = anisotropy;
    let disposed = false;
    let upgrading = false;
    let resolution: TextureResolution = 2048;
    const attempted = new Set<TextureResolution>();
    host.dataset.textureResolution = String(resolution);
    // Show the lightweight globe first. Atomically replace both maps after loading;
    // retain the working pair on errors and release superseded GPU textures.
    const upgradeTextures = async () => {
      const target = desiredResolution(limit, camera.position.length());
      if (disposed || upgrading || target <= resolution || attempted.has(target)) return;
      attempted.add(target);
      upgrading = true;
      const loader = new THREE.TextureLoader();
      const results = await Promise.allSettled(['day', 'night'].map(kind => loader.loadAsync(assetUrl(`maps/earth-${kind}-${target === 8192 ? '8k' : '4k'}.jpg`))));
      const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      if (disposed || loaded.length !== 2) loaded.forEach(map => map.dispose());
      else {
        loaded.forEach(map => { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = anisotropy; });
        uniforms.dayMap.value.dispose(); uniforms.nightMap.value.dispose();
        [uniforms.dayMap.value, uniforms.nightMap.value] = loaded;
        resolution = target;
        host.dataset.textureResolution = String(resolution);
      }
      upgrading = false;
      // A zoom may have arrived while the 4K pair was downloading.
      if (!disposed) void upgradeTextures();
    };
    const requestUpgrade = () => { void upgradeTextures(); };
    controls.addEventListener('change', requestUpgrade);
    requestUpgrade();
    const surface = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec2 mapUv; varying vec3 surfaceNormal;
        void main() { mapUv = uv; surfaceNormal = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDirection;
        varying vec2 mapUv; varying vec3 surfaceNormal;
        void main() {
          float sunlight = dot(normalize(surfaceNormal), sunDirection);
          float daylight = smoothstep(-0.075, 0.075, sunlight);
          vec3 day = texture2D(dayMap, mapUv).rgb * (0.48 + 0.52 * max(sunlight, 0.0));
          vec3 dark = texture2D(dayMap, mapUv).rgb * 0.025 + texture2D(nightMap, mapUv).rgb * 1.25;
          gl_FragColor = vec4(mix(dark, day, daylight), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), surface);
    scene.add(earth);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.023, 48, 32), new THREE.MeshBasicMaterial({ color: 0x578dac, side: THREE.BackSide, transparent: true, opacity: 0.18 }));
    scene.add(halo);
    const pins = new THREE.Group(); scene.add(pins);
    state.current = { pins, camera, controls, target: null };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let start = { x: 0, y: 0 };
    const down = (e: PointerEvent) => { start = { x: e.clientX, y: e.clientY }; };
    const up = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pins.children).find(h => h.object.visible);
      if (hit?.object.userData.place) onSelectRef.current(hit.object.userData.place);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    const observer = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    }); observer.observe(host);
    let frame = 0;
    let solarUpdated = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      if (document.hidden || !host.offsetWidth || !host.offsetHeight) return;
      const now = Date.now();
      if (Math.abs(now - solarUpdated) >= 30000) { const sun = solarPosition(now); uniforms.sunDirection.value.copy(position(sun.lat, sun.lng)); solarUpdated = now; }
      if (state.current?.target) { camera.position.lerp(state.current.target, 0.06); if (camera.position.distanceTo(state.current.target) < 0.005) state.current.target = null; }
      controls.update();
      pins.children.forEach(pin => { pin.visible = pin.position.dot(camera.position.clone().sub(pin.position)) > 0; });
      renderer.render(scene, camera);
    }; render();
    return () => {
      disposed = true;
      controls.removeEventListener('change', requestUpgrade);
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('webglcontextlost', lost);
      scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()); } if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose(); } });
      uniforms.dayMap.value.dispose(); uniforms.nightMap.value.dispose(); renderer.dispose(); renderer.domElement.remove(); state.current = undefined;
    };
  }, []);

  useEffect(() => {
    const current = state.current;
    if (!current) return;
    current.pins.children.forEach(pin => { const sprite = pin as THREE.Sprite; sprite.material.map?.dispose(); sprite.material.dispose(); });
    current.pins.clear();
    places.forEach(place => {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 160;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.fillStyle = place.id === selected?.id ? '#8edcff' : place.videoId ? '#edcd80' : '#9faeb8';
      ctx.beginPath(); ctx.arc(32, 28, 21, Math.PI, 0); ctx.quadraticCurveTo(54, 45, 32, 73); ctx.quadraticCurveTo(10, 45, 11, 28); ctx.fill();
      ctx.fillStyle = '#344954'; ctx.beginPath(); ctx.arc(32, 28, 7, 0, Math.PI * 2); ctx.fill();
      const map = new THREE.CanvasTexture(canvas);
      const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
      pin.position.copy(position(place.lat, place.lng, 1.025)); pin.scale.set(0.085, 0.106, 1); pin.center.set(0.5, 0); pin.userData.place = place; current.pins.add(pin);
    });
  }, [places, selected]);

  useEffect(() => {
    if (selected && state.current) { state.current.controls.autoRotate = false; state.current.target = position(selected.lat, selected.lng, Math.max(2.6, state.current.camera.position.length())); }
  }, [selected]);

  return <div className="world-globe" ref={mount} role="img" aria-label={label}>{failed && <p className="world-webgl-fallback">{fallback}</p>}</div>;
}
