import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n';

const TV_URL = 'https://xixitv.live/';

export const TVApp: React.FC = () => {
  const { language } = useI18n();

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-[#0b1220] text-white dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#172033] px-3 py-2 text-xs sm:px-4 sm:text-sm">
        <div className="min-w-0">
          <span className="font-semibold">{language === 'zh' ? '电视直播' : 'Live TV'}</span>
          <span className="ml-2 text-slate-300">{language === 'zh' ? '内容来自西西TV' : 'Content from Xixi TV'}</span>
        </div>
        <a
          href={TV_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sky-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {language === 'zh' ? '在原站打开' : 'Open original site'}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      <iframe
        title={language === 'zh' ? '西西TV 电视直播' : 'Xixi TV live television'}
        src={TV_URL}
        className="min-h-0 w-full flex-1 border-0 bg-white"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <p className="border-t border-white/10 bg-[#172033] px-3 py-1.5 text-[11px] leading-4 text-slate-300 sm:px-4">
        {language === 'zh'
          ? '若频道无法播放，可能是直播源或网络限制；可尝试在原站打开。'
          : 'If a channel cannot play, its stream or your network may be unavailable. Try the original site.'}
      </p>
    </div>
  );
};
