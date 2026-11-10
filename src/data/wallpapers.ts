import { assetUrl } from '../lib/assetUrl';

export type WallpaperGroup = 'original' | 'apple' | 'dynamic';

export interface WallpaperOption {
  id: string;
  group: WallpaperGroup;
  name: { zh: string; en: string };
  /** File names under public/wallpapers. A single file is used for both appearances. */
  light?: string;
  dark?: string;
  /** Portrait iPhone artwork: shown as-is on phones, centered on wide screens. */
  portrait?: boolean;
  credit?: string;
}

/**
 * Add only wallpapers you have the right to redistribute.
 */
export const WALLPAPERS: WallpaperOption[] = [
  { id: 'animated', group: 'dynamic', name: { zh: '渐变背景', en: 'Gradient' } },
];

export const DEFAULT_WALLPAPER = 'animated';

export const findWallpaper = (id: string) => WALLPAPERS.find((item) => item.id === id) ?? null;

const fileFor = (option: WallpaperOption, dark: boolean) => (dark ? option.dark ?? option.light : option.light ?? option.dark);

/** Large or high-density screens get the 4K file; everything else the lighter 2.5K one. */
const wantsLarge = () => typeof window !== 'undefined' && Math.max(window.screen.width, window.screen.height) * (window.devicePixelRatio || 1) > 2700;

export const wallpaperImageUrl = (option: WallpaperOption, dark: boolean) => {
  const file = fileFor(option, dark);
  if (!file) return null;
  return assetUrl(`wallpapers/${wantsLarge() ? file : file.replace(/\.webp$/, '-2k.webp')}`);
};

/** CSS background for the small preview tiles. */
export const wallpaperThumb = (option: WallpaperOption, dark: boolean) => {
  const file = fileFor(option, dark);
  if (!file) return 'linear-gradient(135deg, #4f46e5, #0ea5e9 55%, #22d3ee)';
  return `center / cover no-repeat url(${assetUrl(`wallpapers/thumbs/${file}`)})`;
};
