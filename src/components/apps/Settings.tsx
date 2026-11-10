import React from 'react';
import { Database, Monitor } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useStore } from '../../store/useStore';

export const SettingsApp: React.FC = () => {
    const { t, language } = useI18n();
    const openApp = useStore((state) => state.openApp);

    return (
        <div className="flex h-full flex-col items-center justify-center bg-gray-100 p-8 text-gray-500 dark:bg-[#1c1c1e] dark:text-gray-300">
            <Monitor size={64} className="mb-4 text-gray-400" />
            <h2 className="text-xl font-bold text-gray-700">{t('settings.title')}</h2>
            <p className="mt-2 text-center">{t('settings.description')}</p>
            <button type="button" onClick={() => openApp('admin')} className="mt-6 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              <Database size={17} />
              {language === 'zh' ? '打开内容后台' : 'Open Content Admin'}
            </button>
        </div>
    );
};
