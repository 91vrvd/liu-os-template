export type TextureResolution = 2048 | 4096 | 8192;

export function textureLimit({ maxTextureSize, compact, memory, saveData, connection }: {
  maxTextureSize: number; compact: boolean; memory?: number; saveData?: boolean; connection?: string;
}): TextureResolution {
  if (saveData || connection === 'slow-2g' || connection === '2g' || maxTextureSize < 4096) return 2048;
  if (compact || (memory !== undefined && memory <= 4) || maxTextureSize < 8192) return 4096;
  return 8192;
}

export function desiredResolution(limit: TextureResolution, distance: number): TextureResolution {
  return limit === 8192 && distance >= 2.8 ? 4096 : limit;
}
