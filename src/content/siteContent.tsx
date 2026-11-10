/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { publicExperience, publicProfile, publicProjects, publicSkillGroups, type PublicExperience, type PublicProfile, type PublicProject, type PublicSkillGroup } from '../data/portfolioData';
import type { MediaTrack } from '../store/useStore';

export interface ManagedSafariBookmark {
  id: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  targetUrl: string;
  icon?: string;
  category: { zh: string; en: string };
  pinned?: boolean;
}

export interface DesktopShortcut {
  id: string;
  label: { zh: string; en: string };
  icon: string;
  appId?: string;
  targetUrl?: string;
  enabled: boolean;
}

export interface SiteContent {
  schemaVersion: 2;
  profile: PublicProfile;
  projects: PublicProject[];
  experiences: PublicExperience[];
  skillGroups: PublicSkillGroup[];
  safariBookmarks: ManagedSafariBookmark[];
  mediaTracks: MediaTrack[];
  desktopShortcuts: DesktopShortcut[];
  publishedAt?: string;
}

export const defaultSiteContent: SiteContent = {
  schemaVersion: 2,
  profile: publicProfile,
  projects: publicProjects,
  experiences: publicExperience,
  skillGroups: publicSkillGroups,
  safariBookmarks: [],
  mediaTracks: [],
  desktopShortcuts: [],
};

interface SiteContentContextValue {
  content: SiteContent;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextValue>({
  content: defaultSiteContent,
  isLoading: false,
  refresh: async () => undefined,
});

const hasSiteContentShape = (value: unknown): value is Omit<SiteContent, 'schemaVersion'> & { schemaVersion: number } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    schemaVersion?: number;
    profile?: unknown;
    projects?: unknown;
    experiences?: unknown;
    skillGroups?: unknown;
    safariBookmarks?: unknown;
    mediaTracks?: unknown;
    desktopShortcuts?: unknown;
  };
  return (candidate.schemaVersion === 1 || candidate.schemaVersion === 2)
    && Boolean(candidate.profile)
    && Array.isArray(candidate.projects)
    && Array.isArray(candidate.experiences)
    && Array.isArray(candidate.skillGroups)
    && Array.isArray(candidate.safariBookmarks)
    && Array.isArray(candidate.mediaTracks)
    && Array.isArray(candidate.desktopShortcuts);
};

export const migrateSiteContent = (value: unknown): SiteContent | null => {
  if (!hasSiteContentShape(value)) return null;
  return { ...value, schemaVersion: 2 } as SiteContent;
};

export const SiteContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);
  const [isLoading, setIsLoading] = useState(true);
  const isDraftPreview = new URLSearchParams(window.location.search).get('preview') === '1';

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(isDraftPreview ? '/api/admin/content' : '/api/content', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
      const payload = await response.json() as { content?: unknown; draft?: unknown; published?: unknown };
      const nextContent = isDraftPreview ? payload.draft ?? payload.published : payload.content;
      const migratedContent = migrateSiteContent(nextContent);
      if (migratedContent) setContent(migratedContent);
    } catch {
      // Local Vite development intentionally falls back to bundled public content.
    } finally {
      setIsLoading(false);
    }
  }, [isDraftPreview]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('liu-os-content');
    const handlePublished = () => void refresh();
    channel?.addEventListener('message', handlePublished);
    window.addEventListener('online', handlePublished);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      channel?.removeEventListener('message', handlePublished);
      channel?.close();
      window.removeEventListener('online', handlePublished);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  const value = useMemo(() => ({ content, isLoading, refresh }), [content, isLoading, refresh]);
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
};

export const useSiteContent = () => useContext(SiteContentContext);
