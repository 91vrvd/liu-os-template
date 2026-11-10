import React from 'react';
import { Bot, BriefcaseBusiness, Clapperboard, Coins, FileStack, Globe2, Megaphone, Smartphone } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { SkillLevel } from '../../data/portfolioData';
import { useSiteContent } from '../../content/siteContent';

const groupIcons: Record<string, typeof Bot> = {
  operations: BriefcaseBusiness,
  web3: Coins,
  marketing: Megaphone,
  'ai-workflow': Bot,
  web: Globe2,
  devices: Smartphone,
  content: Clapperboard,
  documents: FileStack,
};

// Older stored content used regular/working; they map onto the five-step scale.
const levelInfo: Record<SkillLevel, { score: number; zh: string; en: string }> = {
  expert: { score: 5, zh: '精通', en: 'Expert' },
  proficient: { score: 4, zh: '熟练', en: 'Proficient' },
  regular: { score: 4, zh: '熟练', en: 'Proficient' },
  familiar: { score: 3, zh: '熟悉', en: 'Familiar' },
  working: { score: 3, zh: '熟悉', en: 'Familiar' },
  basic: { score: 2, zh: '了解', en: 'Basic' },
  learning: { score: 1, zh: '学习中', en: 'Learning' },
};

const LevelMeter: React.FC<{ level: SkillLevel; language: 'zh' | 'en' }> = ({ level, language }) => {
  const info = levelInfo[level] ?? levelInfo.familiar;
  return (
    <span className="inline-flex shrink-0 items-center gap-2" title={info[language]}>
      <span className="flex gap-[3px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={`h-1.5 w-3.5 rounded-full ${step <= info.score ? 'bg-[#0d8064] dark:bg-[#78d9bf]' : 'bg-gray-200 dark:bg-white/10'}`} />
        ))}
      </span>
      <span className="w-10 text-right text-xs font-semibold text-[#0d6f58] dark:text-[#78d9bf]">{info[language]}</span>
    </span>
  );
};

export const SkillsApp: React.FC = () => {
  const { language, t } = useI18n();
  const { content } = useSiteContent();
  const projectTitleById = (id: string) => content.projects.find((project) => project.id === id)?.title[language] ?? id;

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-[#f5f8f6] px-4 py-6 text-gray-800 transition-colors dark:bg-[#1c1c1c] dark:text-gray-200 sm:px-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-5 dark:border-white/10">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">{t('skills.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
              {language === 'zh' ? '在这里展示你的技能和常用工具。' : 'Add your skills and favorite tools here.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            {(['expert', 'proficient', 'familiar', 'basic', 'learning'] as SkillLevel[]).map((level) => (
              <span key={level} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0d8064] dark:bg-[#78d9bf]" style={{ opacity: levelInfo[level].score / 5 }} />{levelInfo[level][language]}</span>
            ))}
          </div>
        </header>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))' }}>
          {content.skillGroups.map((group) => {
            const Icon = groupIcons[group.id] ?? Bot;
            return (
              <section key={group.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#272727]">
                <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e2f1ec] text-[#0d8064] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white">{group.title[language]}</h3>
                    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{group.description[language]}</p>
                  </div>
                </header>
                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {group.skills.map((skill) => (
                    <li key={skill.name.zh} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="min-w-0 text-sm font-semibold text-gray-900 dark:text-white">{skill.name[language]}</h4>
                        <LevelMeter level={skill.level} language={language} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        {skill.useCases[language].join(language === 'zh' ? '、' : ', ')}
                        {skill.lastUsed[language] ? <span className="text-gray-400 dark:text-gray-500">{language === 'zh' ? ' · ' : ' · '}{skill.lastUsed[language]}</span> : null}
                      </p>
                      {skill.projects.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {skill.projects.map((projectId) => (
                            <span key={projectId} className="rounded bg-[#f1f7f5] px-1.5 py-0.5 text-[10px] text-[#0d6f58] dark:bg-white/5 dark:text-[#9dc5bb]">{projectTitleById(projectId)}</span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
