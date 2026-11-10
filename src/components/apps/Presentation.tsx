import React from 'react';
import { MonitorPlay } from 'lucide-react';
import { useI18n } from '../../i18n';

export const PresentationApp: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="flex h-full items-center justify-center bg-[#f5f5f7] p-8 text-center transition-colors dark:bg-[#1c1c1e]">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-500 shadow-sm dark:bg-blue-400/10 dark:text-blue-300">
          <MonitorPlay size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('presentation.title')}</h1>
        <p className="mt-3 leading-relaxed text-gray-500 dark:text-gray-400">{t('presentation.description')}</p>
      </div>
    </div>
  );
};
