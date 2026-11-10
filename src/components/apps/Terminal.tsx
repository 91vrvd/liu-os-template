import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { terminalContent } from '../../data/systemContent';
import { useStore } from '../../store/useStore';

type HistoryEntry = {
  id: number;
  kind: 'command' | 'output';
  text: string;
};

export const Terminal: React.FC = () => {
  const { language } = useI18n();
  const openApp = useStore((state) => state.openApp);
  const terminal = terminalContent[language];
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory([]);
    setCurrentLine('');
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const getResponse = (input: string) => {
    const command = input.toLowerCase();
    const aliases: Record<string, keyof typeof terminal.commands> = {
      help: 'help', '?': 'help', '帮助': 'help',
      whoami: 'whoami', '我是谁': 'whoami', about: 'whoami',
      resume: 'resume', cv: 'resume', '简历': 'resume',
      projects: 'projects', 'open projects': 'projects', '项目': 'projects',
      skills: 'skills', '技能': 'skills',
      contact: 'contact', '联系': 'contact',
      hobbies: 'hobbies', '爱好': 'hobbies',
      crypto: 'crypto', web3: 'crypto', '加密': 'crypto',
    };
    const key = aliases[command];
    if (key) return terminal.commands[key];

    const index = Math.abs(input.split('').reduce((total, char) => total + char.charCodeAt(0), 0)) % terminal.responses.length;
    return terminal.responses[index];
  };

  const isTVRequest = (input: string) => {
    const normalized = input.normalize('NFKC').toLowerCase().replace(/[\s，。！？,.!?]+/g, '');
    return /^(?:(?:我)?(?:想|要)?看|打开|播放)?(?:电视|电视台|电视直播|直播电视|直播|tv|iptv|livetv|watchtv|television)(?:直播|节目)?$/.test(normalized);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;

    const input = currentLine.trim();
    if (input.toLowerCase() === 'clear') {
      setHistory([]);
      setCurrentLine('');
      return;
    }

    if (!input) {
      setCurrentLine('');
      return;
    }

    const appCommand = ({ music: 'music', '音乐': 'music', '听歌': 'music', games: 'games', game: 'games', '游戏': 'games', notes: 'notes', '备忘录': 'notes', maps: 'maps', '地图': 'maps', 'open projects': 'projects', 'open skills': 'skills' } as Record<string, 'music' | 'games' | 'notes' | 'maps' | 'projects' | 'skills'>)[input.toLowerCase()];
    if (appCommand) {
      setHistory((currentHistory) => [
        ...currentHistory,
        { id: Date.now(), kind: 'command', text: input },
        { id: Date.now() + 1, kind: 'output', text: language === 'zh' ? `正在打开 ${input}…` : `Opening ${input}…` },
      ]);
      setCurrentLine('');
      openApp(appCommand);
      return;
    }

    const wantsTV = isTVRequest(input);
    setHistory((currentHistory) => [
      ...currentHistory,
      { id: Date.now(), kind: 'command', text: input },
      { id: Date.now() + 1, kind: 'output', text: wantsTV
        ? (language === 'zh' ? '已打开电视窗口。' : 'Opened the TV window.')
        : getResponse(input) },
    ]);
    setCurrentLine('');
    if (wantsTV) openApp('tv');
  };

  return (
    <div
      className="flex h-full w-full flex-col items-stretch overflow-hidden bg-[#0b0b0b] p-4 font-mono text-[13px] leading-5 text-[#f2f2f2] shadow-inner"
      onClick={() => inputRef.current?.focus()}
      style={{ fontFamily: "'Fira Code', 'Roboto Mono', monospace" }}
    >
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        {terminal.welcome.map((line) => (
          <div key={line} className="whitespace-pre-wrap break-words text-[#c9c9c9]">
            {line}
          </div>
        ))}
        <div className="h-4" />

        {history.map((entry) => (
          <div key={entry.id} className="whitespace-pre-wrap break-words">
            {entry.kind === 'command' ? (
              <>
                <span className="mr-2 text-[#8bd5ff]">{terminal.prompt}</span>
                <span>{entry.text}</span>
              </>
            ) : (
              <span>{entry.text}</span>
            )}
          </div>
        ))}

        <div className="mt-3 flex items-center">
          <span className="mr-2 text-[#8bd5ff]">{terminal.prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={currentLine}
            onChange={(event) => setCurrentLine(event.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border-none bg-transparent text-[#f2f2f2] caret-[#f2f2f2] outline-none"
            autoFocus
            autoComplete="off"
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
