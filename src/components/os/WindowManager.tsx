import React from 'react';
import { useStore, AppId } from '../../store/useStore';
import { Window } from './Window';
import { AboutApp, ProjectsApp, ExperienceApp, SkillsApp, ContactApp, SettingsApp, VSCodeApp, PresentationApp, ToolboxApp } from '../apps/Apps';
import { Terminal } from '../apps/Terminal';
import { DownloadsApp } from '../apps/Downloads';

const SafariApp = React.lazy(() => import('../apps/Safari').then((module) => ({ default: module.SafariApp })));
const GamesApp = React.lazy(() => import('../apps/Games').then((module) => ({ default: module.GamesApp })));
const NotesApp = React.lazy(() => import('../apps/Notes').then((module) => ({ default: module.NotesApp })));
const AdminApp = React.lazy(() => import('../apps/Admin').then((module) => ({ default: module.AdminApp })));

const TVApp = React.lazy(() => import('../apps/TVApp').then((module) => ({
  default: module.TVApp,
})));

const MusicApp = React.lazy(() => import('../apps/MusicApp'));

const MapsApp = React.lazy(() => import('../apps/maps/MapsApp'));

const LanShareApp = React.lazy(() => import('../apps/ShareRoomApp').then((module) => ({
  default: module.LanShareApp,
})));
const TransferCenterApp = React.lazy(() => import('../apps/TransferCenter').then((module) => ({
  default: module.TransferCenterApp,
})));

const apps: Record<AppId, React.FC> = {
  maps: MapsApp,
  music: MusicApp,
  about: AboutApp,
  projects: ProjectsApp,
  experience: ExperienceApp,
  skills: SkillsApp,
  contact: ContactApp,
  settings: SettingsApp,
  admin: AdminApp,
  safari: SafariApp,
  vscode: VSCodeApp,
  terminal: Terminal,
  tv: TVApp,
  games: GamesApp,
  downloads: DownloadsApp,
  notes: NotesApp,
  presentation: PresentationApp,
  toolbox: ToolboxApp,
  lanShare: LanShareApp,
  transferCenter: TransferCenterApp,
};

export const WindowManager: React.FC = () => {
  const { windows } = useStore();

  return (
    <>
      {Object.entries(windows).map(([id, state]) => {
        if (!state.isOpen) return null;
        
        const AppComponent = apps[id as AppId];
        return (
          <Window key={id} id={id as AppId}>
            <React.Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Liu OS</div>}>
              <AppComponent />
            </React.Suspense>
          </Window>
        );
      })}
    </>
  );
};
