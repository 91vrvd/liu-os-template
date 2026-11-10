import React from 'react';
import { ExternalLink, Github, Globe } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSiteContent } from '../../content/siteContent';

const XIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.964 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
);

export const ContactApp: React.FC = () => {
  const { t } = useI18n();
  const { content } = useSiteContent();
  const profile = content.profile;
  const compactHandle = (value: string) => {
    try {
      const url = new URL(value);
      return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
    } catch {
      return value;
    }
  };

  const links = [
    {
      name: 'GitHub',
      handle: compactHandle(profile.links.github),
      description: t('contact.githubText'),
      href: profile.links.github,
      icon: <Github size={24} />,
    },
    {
      name: 'X',
      handle: compactHandle(profile.links.x),
      description: t('contact.xText'),
      href: profile.links.x,
      icon: <XIcon />,
    },
    ...(profile.links.website ? [{
      name: t('contact.websiteName'),
      handle: compactHandle(profile.links.website),
      description: t('contact.websiteText'),
      href: profile.links.website,
      icon: <Globe size={24} />,
    }] : []),
  ];

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-[#f5f8f6] px-5 py-7 text-gray-800 transition-colors dark:bg-[#1c1c1c] dark:text-gray-200 sm:px-8 sm:py-9">
      <main className="mx-auto max-w-3xl">
        <header className="border-b border-gray-200 pb-6 dark:border-white/10">
          <span className="text-sm font-semibold text-[#0d8064] dark:text-[#78d9bf]">{profile.name}</span>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t('contact.publicTitle')}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-gray-600 dark:text-gray-300">{t('contact.publicText')}</p>
        </header>

        <div className="mt-7 space-y-3">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-24 items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-[#9dc5bb] hover:bg-[#f9fbfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17b890] dark:border-white/10 dark:bg-[#272727] dark:hover:border-[#5e807f] dark:hover:bg-[#2c302f]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#e2f1ec] text-[#0d8064] dark:bg-[#17b890]/15 dark:text-[#78d9bf]">
                {link.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white">{link.name}</h3>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">{link.handle}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{link.description}</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-gray-400 transition-colors group-hover:text-[#0d8064] dark:group-hover:text-[#78d9bf]" />
            </a>
          ))}
        </div>

      </main>
    </div>
  );
};
