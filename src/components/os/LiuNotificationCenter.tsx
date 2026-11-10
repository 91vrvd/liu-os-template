import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Users, X } from 'lucide-react';
import { useShare } from '../../share/ShareProvider';
import { useStore } from '../../store/useStore';

const notificationIcon = {
  info: CheckCircle2,
  member: Users,
  transfer: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
} as const;

export const LiuNotificationCenter: React.FC = () => {
  const { notifications, dismissNotification, markNotificationsRead } = useShare();
  const openApp = useStore((state) => state.openApp);
  const visible = notifications.filter((item) => !item.read).slice(0, 3);

  return (
    <div
      className="pointer-events-none fixed left-2 right-2 top-[38px] z-[10000] flex flex-col items-end gap-2 sm:left-auto sm:right-3 sm:w-[356px]"
      aria-live="polite"
      aria-label="Liu OS notifications"
    >
      <AnimatePresence initial={false}>
        {visible.map((item) => {
          const Icon = notificationIcon[item.kind];
          return (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, x: 34, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 28, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex w-full cursor-pointer items-start gap-3 rounded-[14px] border border-white/55 bg-white/78 p-3 text-slate-800 shadow-[0_16px_42px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#2a2a2d]/86 dark:text-white"
              onClick={() => {
                markNotificationsRead(item.appId);
                openApp(item.appId === 'privateShare' ? 'lanShare' : item.appId);
              }}
            >
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${
                item.kind === 'error' || item.kind === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'bg-[#17b890] text-white'
              }`}>
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[13px] font-semibold">{item.title}</strong>
                <span className="mt-0.5 block text-[12px] leading-5 text-slate-600 dark:text-slate-300">{item.body}</span>
              </span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={(event) => {
                  event.stopPropagation();
                  dismissNotification(item.id);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X size={15} />
              </button>
            </motion.article>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
