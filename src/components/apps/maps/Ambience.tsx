import { useEffect, useRef, useState } from 'react';

export default function Ambience({ english }: { english: boolean }) {
  const audio = useRef<{ context: AudioContext; gains: GainNode[] }>();
  const [volumes, setVolumes] = useState([0, 0, 0]);
  const [error, setError] = useState(false);
  const names = english ? ['Rain', 'Ocean', 'Wind'] : ['雨声', '海浪', '微风'];
  useEffect(() => () => { void audio.current?.context.close(); }, []);
  const change = async (index: number, value: number) => {
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const gains = [0, 1, 2].map(i => {
          const buffer = context.createBuffer(1, context.sampleRate * 5, context.sampleRate);
          const samples = buffer.getChannelData(0);
          let brown = 0;
          for (let n = 0; n < samples.length; n++) { const white = Math.random() * 2 - 1; brown = (brown + white * 0.02) / 1.02; samples[n] = i === 0 ? white * 0.32 : brown * 3; }
          const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
          const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = [3600, 800, 380][i];
          const gain = context.createGain(); gain.gain.value = 0;
          source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start();
          return gain;
        });
        audio.current = { context, gains };
      }
      await audio.current.context.resume();
      audio.current.gains[index].gain.setTargetAtTime(value / 100 * 0.35, audio.current.context.currentTime, 0.2);
      setVolumes(old => old.map((v, i) => i === index ? value : v)); setError(false);
    } catch { setError(true); }
  };
  return <div className="world-mixer"><h3>{english ? 'A little company' : '一点陪伴'}</h3><p>{english ? 'Mix gentle ambient sounds, even when a camera is offline.' : '把喜欢的环境音混在一起，摄像头离线也能听。'}</p>{names.map((name, i) => <label key={name}><span>{name}</span><input type="range" min="0" max="100" step="1" value={volumes[i]} onChange={e => void change(i, +e.target.value)} aria-label={name} /><output>{volumes[i]}%</output></label>)}<button onClick={() => { [0, 1, 2].forEach(i => void change(i, 0)); }}>{english ? 'Mute all' : '全部静音'}</button>{error && <p role="status">{english ? 'Sound could not start. Try touching a volume slider again.' : '声音暂时没能启动，请再试着调整一下音量。'}</p>}</div>;
}
