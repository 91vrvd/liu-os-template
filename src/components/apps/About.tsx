import React from 'react';
import { Github, Globe, MapPin } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSiteContent } from '../../content/siteContent';

const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.964 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
);

export const AboutApp: React.FC = () => {
  const { language } = useI18n();
  const { content } = useSiteContent();
  const profile = content.profile;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-gray-800 transition-colors dark:bg-[#1c1c1c] dark:text-gray-200 md:flex-row">
      <aside className="flex h-[34%] min-h-[176px] max-h-[224px] shrink-0 flex-col items-center border-b border-gray-200 bg-[#f3f6f5] p-4 text-center transition-colors dark:border-white/10 dark:bg-[#242827] md:h-auto md:max-h-none md:min-h-0 md:w-[19rem] md:border-b-0 md:border-r md:p-6">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-[#dbe8e3] text-xl font-bold text-[#0d6f58] shadow-sm dark:border-white/10 dark:bg-[#29443c] dark:text-[#7fdec5] md:mb-4 md:h-28 md:w-28 md:border-4 md:text-3xl">
          {profile.name.slice(0, 2)}
        </div>
        <h2 className="text-xl font-bold md:text-2xl">{profile.name}</h2>
        <p className="mt-1 max-w-[20rem] text-xs font-medium leading-5 text-gray-600 dark:text-gray-300 md:mt-2 md:max-w-[15rem] md:text-sm md:leading-relaxed">
          {profile.headline[language]}
        </p>
        <div className="mt-1.5 flex items-center text-xs text-gray-500 dark:text-gray-400 md:mt-3 md:text-sm">
          <MapPin size={14} className="mr-1.5" />
          {profile.location[language]}
        </div>
        <div className="mt-2 flex gap-3 md:mt-auto">
          <a
            href={profile.links.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:border-[#17b890] hover:text-[#0e8f70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
          >
            <Github size={20} />
          </a>
          <a
            href={profile.links.x}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
            title="X"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:border-[#17b890] hover:text-[#0e8f70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
          >
            <XIcon />
          </a>
          {profile.links.website && (
            <a
              href={profile.links.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={language === 'zh' ? '个人网站' : 'Website'}
              title={profile.links.website.replace(/^https?:\/\//, '')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:border-[#17b890] hover:text-[#0e8f70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
            >
              <Globe size={20} />
            </a>
          )}
        </div>
      </aside>

      <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
        {profile.highlights && profile.highlights.length > 0 && (
          <section className="mx-auto mb-7 grid max-w-3xl gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            {profile.highlights.map((item) => (
              <div key={item.value + item.label.en} className="rounded-2xl border border-gray-200 bg-[#f7faf9] px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="text-2xl font-bold text-[#0d8064] dark:text-[#78d9bf]">{item.value}</div>
                <div className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">{item.label[language]}</div>
              </div>
            ))}
          </section>
        )}
        <section className="mx-auto max-w-3xl">
          <h3 className="border-b border-gray-200 pb-3 text-xl font-bold dark:border-white/10">
            {language === 'zh' ? '个人简介' : 'Profile'}
          </h3>
          <div className="mt-5 space-y-4 leading-7 text-gray-600 dark:text-gray-300">
            {profile.introduction[language].map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-8 max-w-3xl border-t border-gray-200 pt-6 dark:border-white/10">
          <h3 className="text-xl font-bold">{profile.focusTitle[language]}</h3>
          <p className="mt-3 leading-7 text-gray-600 dark:text-gray-300">{profile.focus[language]}</p>
        </section>

        {profile.lifeSkills && profile.lifeSkills[language].length > 0 && (
          <section className="mx-auto mt-8 max-w-3xl border-t border-gray-200 pt-6 dark:border-white/10">
            <h3 className="text-xl font-bold">{language === 'zh' ? '工作之外' : 'Outside work'}</h3>
            {profile.hobbies && <p className="mt-3 leading-7 text-gray-600 dark:text-gray-300">{profile.hobbies[language]}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.lifeSkills[language].map((item) => (
                <span key={item} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">{item}</span>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
};
