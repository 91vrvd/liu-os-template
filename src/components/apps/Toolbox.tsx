import React from 'react';
import { Wrench } from 'lucide-react';
import { useI18n } from '../../i18n';

export const ToolboxApp: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="flex h-full items-center justify-center bg-[#f5f5f7] p-8 text-center transition-colors dark:bg-[#1c1c1e]">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 shadow-sm dark:bg-emerald-400/10 dark:text-emerald-300">
          <Wrench size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('toolbox.title')}</h1>
        <p className="mt-3 leading-relaxed text-gray-500 dark:text-gray-400">{t('toolbox.description')}</p>
      </div>
    </div>
  );
};
