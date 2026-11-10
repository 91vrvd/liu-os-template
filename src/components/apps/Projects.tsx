import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  Github,
  LayoutGrid,
  List,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '../../i18n';
import type { PublicProject } from '../../data/portfolioData';
import { useSiteContent } from '../../content/siteContent';

const DetailList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-2">
        <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#17b890]" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const ProjectDetail: React.FC<{ project: PublicProject; onBack: () => void }> = ({ project, onBack }) => {
  const { language, t } = useI18n();
  const sections = [
    [t('projects.background'), project.background[language]],
    [t('projects.motivation'), project.motivation[language]],
    [t('projects.problem'), project.problem[language]],
  ] as const;

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-white text-gray-800 dark:bg-[#1c1c1c] dark:text-gray-200">
      <header className="sticky top-0 z-10 flex min-h-12 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#242424]/95">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('projects.back')}
          title={t('projects.back')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="truncate text-sm font-semibold">{project.title[language]}</span>
      </header>

      <article className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-6 border-b border-gray-200 pb-8 dark:border-white/10 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <span className="inline-flex rounded-full bg-[#e5f4ef] px-3 py-1 text-xs font-semibold text-[#0d6f58] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">
              {project.category[language]}
            </span>
            <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{project.title[language]}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300">
              {project.summary[language]}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {project.tech.map((tech) => (
                <span key={tech} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 dark:border-white/10 dark:text-gray-300">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-[#eef3f1] dark:border-white/10 dark:bg-[#26302d]">
            {project.screenshot ? (
              <img src={project.screenshot} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <FolderKanban size={54} className="text-[#5e807f]" aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="grid gap-x-10 md:grid-cols-2">
          {sections.map(([title, body]) => (
            <section key={title} className="border-b border-gray-200 py-6 dark:border-white/10">
              <h2 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-700 dark:text-gray-300">{body}</p>
            </section>
          ))}

          <section className="border-b border-gray-200 py-6 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{t('projects.status')}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-700 dark:text-gray-300">{project.status[language]}</p>
          </section>

          <section className="border-b border-gray-200 py-6 dark:border-white/10">
            <h2 className="mb-3 text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{t('projects.features')}</h2>
            <DetailList items={project.features[language]} />
          </section>
          <section className="border-b border-gray-200 py-6 dark:border-white/10">
            <h2 className="mb-3 text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{t('projects.role')}</h2>
            <DetailList items={project.role[language]} />
          </section>
          <section className="border-b border-gray-200 py-6 dark:border-white/10">
            <h2 className="mb-3 text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{t('projects.challenges')}</h2>
            <DetailList items={project.challenges[language]} />
          </section>
          <section className="border-b border-gray-200 py-6 dark:border-white/10">
            <h2 className="mb-3 text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{t('projects.solutions')}</h2>
            <DetailList items={project.solutions[language]} />
          </section>
          <section className="border-b border-gray-200 py-6 dark:border-white/10 md:col-span-2">
            <h2 className="mb-3 text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{t('projects.next')}</h2>
            <DetailList items={project.next[language]} />
          </section>
        </div>

        <footer className="flex flex-wrap items-center gap-3 py-7">
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-gray-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              <Github size={17} /> {t('projects.github')}
            </a>
          )}
          {project.live && (
            <a
              href={project.live}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#17b890] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#119b78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890]"
            >
              <ExternalLink size={17} /> {t('projects.live')}
            </a>
          )}
          {!project.github && !project.live && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('projects.noExternal')}</span>
          )}
        </footer>
      </article>
    </div>
  );
};

export const ProjectsApp: React.FC = () => {
  const { language, t } = useI18n();
  const { content } = useSiteContent();
  const projects = content.projects;
  const [categoryKey, setCategoryKey] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project) => map.set(project.category.zh, project.category[language]));
    return [...map.entries()];
  }, [language, projects]);

  const selectedProject = projects.find((project) => project.id === selectedId);
  const visibleProjects = categoryKey === 'all'
    ? projects
    : projects.filter((project) => project.category.zh === categoryKey);

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f8f6] font-sans text-gray-800 transition-colors dark:bg-[#1c1c1c] dark:text-gray-200">
      <div className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 dark:border-white/10 dark:bg-[#272727] sm:px-4">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setCategoryKey('all')}
            className={clsx(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              categoryKey === 'all' ? 'bg-[#dff2ec] text-[#0d6f58] dark:bg-[#17b890]/20 dark:text-[#7fdec5]' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10',
            )}
          >
            {t('projects.all')}
          </button>
          {categories.map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => setCategoryKey(key)}
              className={clsx(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                categoryKey === key ? 'bg-[#dff2ec] text-[#0d6f58] dark:bg-[#17b890]/20 dark:text-[#7fdec5]' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-white/10 dark:bg-black/20">
          <button
            type="button"
            aria-label={t('projects.gridView')}
            title={t('projects.gridView')}
            onClick={() => setView('grid')}
            className={clsx('rounded p-1.5 transition-colors', view === 'grid' ? 'bg-white text-black shadow-sm dark:bg-white/15 dark:text-white' : 'text-gray-500')}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            aria-label={t('projects.listView')}
            title={t('projects.listView')}
            onClick={() => setView('list')}
            className={clsx('rounded p-1.5 transition-colors', view === 'list' ? 'bg-white text-black shadow-sm dark:bg-white/15 dark:text-white' : 'text-gray-500')}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
        <div className={clsx('mx-auto max-w-6xl gap-4', view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>
          {visibleProjects.map((project) => (
            <button
              type="button"
              key={project.id}
              onClick={() => setSelectedId(project.id)}
              aria-label={`${t('projects.openDetails')}: ${project.title[language]}`}
              className={clsx(
                'group flex overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#9dc5bb] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-[#272727] dark:hover:border-[#5e807f]',
                view === 'grid' ? 'flex-col' : 'min-h-28 flex-row items-stretch',
              )}
            >
              <div className={clsx('flex shrink-0 items-center justify-center overflow-hidden bg-[#e9f0ee] dark:bg-[#26322f]', view === 'grid' ? 'aspect-[16/8] w-full' : 'w-28 sm:w-40')}>
                {project.screenshot ? (
                  <img src={project.screenshot} alt="" className="h-full w-full object-cover object-top" />
                ) : (
                  <FolderKanban size={view === 'grid' ? 42 : 34} className="text-[#5e807f] transition-transform group-hover:scale-105" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-base font-bold leading-snug text-gray-900 dark:text-white">{project.title[language]}</h3>
                  <span className="shrink-0 rounded-full bg-[#e5f4ef] px-2 py-0.5 text-[11px] font-semibold text-[#0d6f58] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">
                    {project.category[language]}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-400">{project.summary[language]}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  {project.tech.slice(0, view === 'grid' ? 4 : 6).map((tech) => (
                    <span key={tech} className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500 dark:border-white/10 dark:text-gray-400">{tech}</span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
