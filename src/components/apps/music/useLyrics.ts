import { useEffect, useMemo, useState } from 'react';
import type { MediaTrack } from '../../../store/useStore';
import { LyricLine, loadLyrics } from '../../../lib/musicSources';

export const useLyrics = (track: MediaTrack | null, position: number) => {
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [loaded, setLoaded] = useState(true);

  useEffect(() => {
    let active = true;
    setLines([]);
    setLoaded(!track?.lyricUrl);
    if (track?.lyricUrl) {
      void loadLyrics(track.lyricUrl).then((result) => {
        if (!active) return;
        setLines(result);
        setLoaded(true);
      });
    }
    return () => { active = false; };
  }, [track?.lyricUrl]);

  const current = useMemo(() => {
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].time <= position + 0.3) index = i;
      else break;
    }
    return index;
  }, [lines, position]);

  return { lines, loaded, current };
};
