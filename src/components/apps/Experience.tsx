import React from 'react';
import { BriefcaseBusiness, CalendarDays, CheckCircle2, Lightbulb, Wrench } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSiteContent } from '../../content/siteContent';

export const ExperienceApp: React.FC = () => {
  const { language, t } = useI18n();
  const { content } = useSiteContent();

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-[#f5f8f6] px-4 py-6 text-gray-800 transition-colors dark:bg-[#1c1c1c] dark:text-gray-200 sm:px-7">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 border-b border-gray-200 pb-5 dark:border-white/10">
          <h2 className="text-2xl font-bold sm:text-3xl">{t('experience.title')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
            {language === 'zh'
              ? '在这里展示你的工作经历与实践。'
              : 'Add your work and project experience here.'}
          </p>
        </header>

        <div className="space-y-5">
          {content.experiences.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#272727]">
              <div className="flex flex-col gap-4 border-b border-gray-200 p-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e2f1ec] text-[#0d8064] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">
                    <BriefcaseBusiness size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[#0d8064] dark:text-[#78d9bf]">{item.type[language]}</span>
                    <h3 className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">{item.title[language]}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.context[language]}</p>
                  </div>
                </div>
                <time className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">
                  <CalendarDays size={13} />
                  {item.period[language]}
                </time>
              </div>

              <div className="p-5">
                <p className="leading-7 text-gray-700 dark:text-gray-300">{item.summary[language]}</p>

                <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(14rem,1fr)]">
                  <section>
                    <h4 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">{t('experience.responsibilities')}</h4>
                    <ul className="space-y-2.5">
                      {item.responsibilities[language].map((responsibility) => (
                        <li key={responsibility} className="flex items-start gap-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                          <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#17b890]" />
                          <span>{responsibility}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <div className="space-y-5 border-t border-gray-200 pt-5 dark:border-white/10 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <section>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                        <Wrench size={15} /> {t('experience.tools')}
                      </h4>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.tools.map((tool) => (
                          <span key={tool} className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">{tool}</span>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                        <Lightbulb size={15} /> {t('experience.learning')}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{item.learning[language]}</p>
                    </section>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">{t('experience.status')}:</span> {item.status[language]}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
