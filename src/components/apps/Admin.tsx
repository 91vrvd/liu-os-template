import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CloudUpload, Eye, Github, ImageUp, ListPlus, LogOut, Plus, Send, Trash2 } from 'lucide-react';
import { defaultSiteContent, migrateSiteContent, type DesktopShortcut, type ManagedSafariBookmark, type SiteContent, useSiteContent } from '../../content/siteContent';
import type { PublicExperience, PublicProject, PublicSkill, PublicSkillGroup } from '../../data/portfolioData';
import type { MediaTrack } from '../../store/useStore';
import { useI18n } from '../../i18n';

type AdminSection = 'profile' | 'projects' | 'experiences' | 'skills' | 'safari' | 'music' | 'desktop';
type SessionPayload = { authenticated: boolean; authorized: boolean; login?: string; avatarUrl?: string };
type DraftPayload = { draft: unknown | null; published: unknown | null; draftUpdatedAt?: string; publishedAt?: string };

const fieldClass = 'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-black/20 dark:text-slate-100';
const labelClass = 'block text-xs font-semibold text-slate-600 dark:text-slate-300';
const panelClass = 'rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]';

const cloneContent = (content: SiteContent) => JSON.parse(JSON.stringify(content)) as SiteContent;
const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
const joinLines = (value: string[]) => value.join('\n');
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, multiline, placeholder }) => (
  <label className={labelClass}>
    {label}
    {multiline
      ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className={`${fieldClass} resize-y`} />
      : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={fieldClass} />}
  </label>
);

const LocalizedField: React.FC<{
  label: string;
  value: { zh: string; en: string };
  onChange: (value: { zh: string; en: string }) => void;
  multiline?: boolean;
}> = ({ label, value, onChange, multiline }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <TextField label={`${label}（中文）`} value={value.zh} onChange={(zh) => onChange({ ...value, zh })} multiline={multiline} />
    <TextField label={`${label}（English）`} value={value.en} onChange={(en) => onChange({ ...value, en })} multiline={multiline} />
  </div>
);

const SectionHeader: React.FC<{ title: string; description: string; onAdd?: () => void; addLabel?: string }> = ({ title, description, onAdd, addLabel }) => (
  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
    <div>
      <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
    {onAdd && <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><Plus size={14} />{addLabel}</button>}
  </header>
);

const ItemRail: React.FC<{
  items: Array<{ id: string; label: string }>;
  selected: number;
  onSelect: (index: number) => void;
}> = ({ items, selected, onSelect }) => (
  <aside className="custom-scrollbar max-h-44 overflow-y-auto border-b border-slate-200 p-2 dark:border-white/10 lg:max-h-none lg:w-52 lg:shrink-0 lg:border-b-0 lg:border-r">
    {items.map((item, index) => (
      <button key={`${item.id}-${index}`} type="button" onClick={() => onSelect(index)} className={`mb-1 w-full truncate rounded-md px-3 py-2 text-left text-xs ${selected === index ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>
        {item.label || item.id || `#${index + 1}`}
      </button>
    ))}
  </aside>
);

const emptyProject = (): PublicProject => ({
  id: `project-${Date.now()}`,
  title: { zh: '新项目', en: 'New Project' },
  category: { zh: '个人项目', en: 'Personal Project' },
  summary: { zh: '', en: '' },
  background: { zh: '', en: '' },
  motivation: { zh: '', en: '' },
  problem: { zh: '', en: '' },
  features: { zh: [], en: [] },
  role: { zh: [], en: [] },
  challenges: { zh: [], en: [] },
  solutions: { zh: [], en: [] },
  status: { zh: '草稿', en: 'Draft' },
  next: { zh: [], en: [] },
  tech: [],
});

const emptyExperience = (): PublicExperience => ({
  id: `experience-${Date.now()}`,
  type: { zh: '实践经历', en: 'Practice' },
  title: { zh: '新经历', en: 'New Experience' },
  context: { zh: '', en: '' },
  period: { zh: '', en: '' },
  summary: { zh: '', en: '' },
  responsibilities: { zh: [], en: [] },
  tools: [],
  learning: { zh: '', en: '' },
  status: { zh: '进行中', en: 'Ongoing' },
});

const emptySkill = (): PublicSkill => ({
  name: { zh: '新技能', en: 'New Skill' },
  level: 'learning',
  useCases: { zh: [], en: [] },
  projects: [],
  lastUsed: { zh: '近期', en: 'Recently' },
});

const emptySkillGroup = (): PublicSkillGroup => ({
  id: `skill-group-${Date.now()}`,
  title: { zh: '新技能分类', en: 'New Skill Group' },
  description: { zh: '', en: '' },
  skills: [emptySkill()],
});

const emptyBookmark = (): ManagedSafariBookmark => ({
  id: `bookmark-${Date.now()}`,
  title: { zh: '新收藏', en: 'New Favorite' },
  description: { zh: '', en: '' },
  targetUrl: '',
  category: { zh: '我的网站', en: 'My Website' },
  pinned: true,
});

const emptyTrack = (): MediaTrack => ({
  id: `track-${Date.now()}`,
  title: '新音乐',
  artist: '',
  platform: 'direct',
  playback: 'native',
});

const emptyShortcut = (): DesktopShortcut => ({
  id: `shortcut-${Date.now()}`,
  label: { zh: '新快捷方式', en: 'New Shortcut' },
  icon: '',
  targetUrl: '',
  enabled: true,
});

export const AdminApp: React.FC = () => {
  const { language } = useI18n();
  const { refresh } = useSiteContent();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [draft, setDraft] = useState<SiteContent>(() => cloneContent(defaultSiteContent));
  const [section, setSection] = useState<AdminSection>('profile');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);

  const copy = language === 'zh' ? {
    title: '内容后台',
    subtitle: '修改草稿、预览并发布。发布后所有访问者会读取同一份最新内容。',
    login: '使用 GitHub 登录',
    loginHint: '只有已授权的 GitHub 账号可以保存和发布内容。',
    unauthorized: '当前 GitHub 账号没有管理权限。',
    save: '保存草稿',
    publish: '发布到网站',
    preview: '预览草稿',
    logout: '退出',
    saved: '草稿已保存',
    published: '已发布，前台正在刷新',
    upload: '上传图片或音频',
  } : {
    title: 'Content Admin',
    subtitle: 'Edit a draft, preview it, and publish. Every visitor receives the same published content.',
    login: 'Sign in with GitHub',
    loginHint: 'Only the authorized GitHub account can save or publish content.',
    unauthorized: 'This GitHub account is not authorized to manage the site.',
    save: 'Save Draft',
    publish: 'Publish',
    preview: 'Preview Draft',
    logout: 'Sign Out',
    saved: 'Draft saved',
    published: 'Published. The public site is refreshing.',
    upload: 'Upload Image or Audio',
  };

  const sections = useMemo<Array<{ id: AdminSection; zh: string; en: string; count?: number }>>(() => [
    { id: 'profile', zh: '关于与联系', en: 'Profile & Contact' },
    { id: 'projects', zh: '项目', en: 'Projects', count: draft.projects.length },
    { id: 'experiences', zh: '经历', en: 'Experience', count: draft.experiences.length },
    { id: 'skills', zh: '技能', en: 'Skills', count: draft.skillGroups.length },
    { id: 'safari', zh: 'Safari 收藏', en: 'Safari Favorites', count: draft.safariBookmarks.length },
    { id: 'music', zh: '音乐列表', en: 'Music', count: draft.mediaTracks.length },
    { id: 'desktop', zh: '桌面快捷方式', en: 'Desktop Shortcuts', count: draft.desktopShortcuts.length },
  ], [draft]);

  useEffect(() => {
    let active = true;
    void fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: SessionPayload) => {
        if (!active) return;
        setSession(payload);
        if (payload.authorized) {
          void fetch('/api/admin/content', { cache: 'no-store' })
            .then((response) => response.json())
            .then((contentPayload: DraftPayload) => {
              if (!active) return;
              const storedContent = contentPayload.draft ?? contentPayload.published;
              const migratedContent = migrateSiteContent(storedContent);
              const storedVersion = storedContent && typeof storedContent === 'object' && 'schemaVersion' in storedContent
                ? (storedContent as { schemaVersion?: number }).schemaVersion
                : undefined;
              setDraft(cloneContent(migratedContent ?? defaultSiteContent));
              setDirty(!storedContent || storedVersion !== defaultSiteContent.schemaVersion);
            });
        }
      })
      .catch(() => setSession({ authenticated: false, authorized: false }));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
    setSelectedSkillIndex(0);
  }, [section]);

  const mutate = (updater: (current: SiteContent) => SiteContent) => {
    setDraft((current) => updater(current));
    setDirty(true);
    setStatus('');
  };

  const saveDraft = async () => {
    setSaving(true);
    setStatus('');
    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      if (!response.ok) throw new Error('save-failed');
      setDirty(false);
      setStatus(copy.saved);
    } catch {
      setStatus(language === 'zh' ? '保存失败，请重新登录后再试。' : 'Save failed. Please sign in again.');
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (dirty) {
      setStatus(language === 'zh' ? '请先保存草稿，再发布。' : 'Save the draft before publishing.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/admin/content/publish', { method: 'POST' });
      if (!response.ok) throw new Error('publish-failed');
      setStatus(copy.published);
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('liu-os-content');
        channel.postMessage({ type: 'published', at: Date.now() });
        channel.close();
      }
      await refresh();
    } catch {
      setStatus(language === 'zh' ? '发布失败，请稍后重试。' : 'Publish failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const previewDraft = () => {
    if (dirty) {
      setStatus(language === 'zh' ? '请先保存草稿，再打开预览。' : 'Save the draft before opening preview.');
      return;
    }
    const previewUrl = new URL(`${import.meta.env.BASE_URL}?preview=1`, window.location.origin);
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const uploadMedia = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch('/api/admin/media', { method: 'POST', body: form });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? 'upload-failed');
      setUploadedUrl(payload.url);
      setStatus(language === 'zh' ? '上传完成，地址已显示在上方。' : 'Upload complete. The URL is shown above.');
    } catch {
      setStatus(language === 'zh' ? '上传失败；请使用小于 15 MB 的图片或音频。' : 'Upload failed. Use an image or audio file under 15 MB.');
    } finally {
      setSaving(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  if (!session) return <div className="flex h-full items-center justify-center bg-[#f5f8f6] text-sm text-slate-500 dark:bg-[#1c1c1e] dark:text-slate-400">正在连接后台…</div>;

  if (!session.authorized) {
    return <div className="flex h-full items-center justify-center bg-[#f5f8f6] p-6 dark:bg-[#1c1c1e]">
      <div className={`${panelClass} max-w-md p-7 text-center`}>
        <Github className="mx-auto text-slate-700 dark:text-slate-200" size={42} />
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{session.authenticated ? copy.unauthorized : copy.loginHint}</p>
        {!session.authenticated && <a href="/api/auth/github/start" className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-black"><Github size={17} />{copy.login}</a>}
      </div>
    </div>;
  }

  const selectedProject = draft.projects[selectedIndex];
  const selectedExperience = draft.experiences[selectedIndex];
  const selectedGroup = draft.skillGroups[selectedIndex];
  const selectedSkill = selectedGroup?.skills[selectedSkillIndex];
  const selectedBookmark = draft.safariBookmarks[selectedIndex];
  const selectedTrack = draft.mediaTracks[selectedIndex];
  const selectedShortcut = draft.desktopShortcuts[selectedIndex];

  const removeAt = <K extends 'projects' | 'experiences' | 'skillGroups' | 'safariBookmarks' | 'mediaTracks' | 'desktopShortcuts'>(key: K, index: number) => {
    mutate((current) => ({ ...current, [key]: current[key].filter((_, itemIndex) => itemIndex !== index) }));
    setSelectedIndex(Math.max(0, index - 1));
  };

  return <div data-window-interactive="true" className="flex h-full min-h-0 select-text flex-col overflow-hidden bg-[#f5f8f6] text-slate-800 dark:bg-[#1c1c1e] dark:text-slate-100">
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-[#29292b]">
      <div className="min-w-0">
        <h1 className="font-semibold">{copy.title}</h1>
        <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">{copy.subtitle}</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" disabled={dirty} onClick={previewDraft} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/10"><Eye size={14} />{copy.preview}</button>
        <button type="button" disabled={saving || !dirty} onClick={() => void saveDraft()} className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"><CloudUpload size={14} />{copy.save}</button>
        <button type="button" disabled={saving || dirty} onClick={() => void publishDraft()} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Send size={14} />{copy.publish}</button>
        <a href="/api/auth/logout" title={copy.logout} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><LogOut size={15} /></a>
      </div>
    </header>

    {(status || dirty) && <div className={`shrink-0 border-b px-4 py-2 text-xs ${dirty ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>{status || (language === 'zh' ? '有尚未保存的修改' : 'Unsaved changes')}</div>}

    <div className="flex min-h-0 flex-1">
      <nav className="custom-scrollbar w-40 shrink-0 overflow-y-auto border-r border-slate-200 bg-white/60 p-2 dark:border-white/10 dark:bg-white/[0.03] sm:w-48">
        <div className="mb-2 flex items-center gap-2 px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
          {session.avatarUrl && <img src={session.avatarUrl} alt="" className="h-6 w-6 rounded-full" />}
          <span className="truncate">@{session.login}</span>
        </div>
        {sections.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs ${section === item.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}><span>{language === 'zh' ? item.zh : item.en}</span>{typeof item.count === 'number' && <span className="opacity-70">{item.count}</span>}</button>)}
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/mp4,audio/wav,audio/ogg" className="hidden" onChange={(event) => void uploadMedia(event.target.files?.[0])} />
          <button type="button" onClick={() => uploadRef.current?.click()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><ImageUp size={14} />{copy.upload}</button>
          {uploadedUrl && <button type="button" title={uploadedUrl} onClick={() => void navigator.clipboard.writeText(uploadedUrl)} className="mt-1 flex w-full items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-left text-[10px] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"><Check size={12} /><span className="truncate">{uploadedUrl}</span></button>}
        </div>
      </nav>

      <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {section === 'profile' && <section className={panelClass}>
          <SectionHeader title={language === 'zh' ? '关于我与公开联系' : 'Profile and Public Contact'} description={language === 'zh' ? '这里控制关于我、当前方向、公开地区范围及 GitHub / X 链接。不要填写私人联系方式。' : 'Controls the About window, current focus, public location, and public GitHub / X links.'} />
          <div className="space-y-4 p-5">
            <TextField label={language === 'zh' ? '公开昵称' : 'Public Name'} value={draft.profile.name} onChange={(name) => mutate((current) => ({ ...current, profile: { ...current.profile, name } }))} />
            <LocalizedField label={language === 'zh' ? '一句话介绍' : 'Headline'} value={draft.profile.headline} onChange={(headline) => mutate((current) => ({ ...current, profile: { ...current.profile, headline } }))} />
            <LocalizedField label={language === 'zh' ? '公开地区' : 'Public Location'} value={draft.profile.location} onChange={(location) => mutate((current) => ({ ...current, profile: { ...current.profile, location } }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="个人简介（中文，每段一行）" value={joinLines(draft.profile.introduction.zh)} onChange={(value) => mutate((current) => ({ ...current, profile: { ...current.profile, introduction: { ...current.profile.introduction, zh: lines(value) } } }))} multiline />
              <TextField label="Profile (English, one paragraph per line)" value={joinLines(draft.profile.introduction.en)} onChange={(value) => mutate((current) => ({ ...current, profile: { ...current.profile, introduction: { ...current.profile.introduction, en: lines(value) } } }))} multiline />
            </div>
            <LocalizedField label={language === 'zh' ? '当前方向标题' : 'Focus Title'} value={draft.profile.focusTitle} onChange={(focusTitle) => mutate((current) => ({ ...current, profile: { ...current.profile, focusTitle } }))} />
            <LocalizedField label={language === 'zh' ? '当前方向内容' : 'Current Focus'} value={draft.profile.focus} onChange={(focus) => mutate((current) => ({ ...current, profile: { ...current.profile, focus } }))} multiline />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="GitHub" value={draft.profile.links.github} onChange={(github) => mutate((current) => ({ ...current, profile: { ...current.profile, links: { ...current.profile.links, github } } }))} />
              <TextField label="X" value={draft.profile.links.x} onChange={(x) => mutate((current) => ({ ...current, profile: { ...current.profile, links: { ...current.profile.links, x } } }))} />
            </div>
          </div>
        </section>}

        {section === 'projects' && <section className={panelClass}>
          <SectionHeader title={language === 'zh' ? '项目管理' : 'Project Management'} description={language === 'zh' ? '新增项目后可填写详情、截图、仓库和在线体验地址。' : 'Add projects with full details, screenshots, repositories, and live links.'} addLabel={language === 'zh' ? '新增项目' : 'Add Project'} onAdd={() => mutate((current) => ({ ...current, projects: [...current.projects, emptyProject()] }))} />
          <div className="lg:flex">
            <ItemRail items={draft.projects.map((item) => ({ id: item.id, label: item.title[language] }))} selected={selectedIndex} onSelect={setSelectedIndex} />
            {selectedProject && <div className="min-w-0 flex-1 space-y-4 p-5">
              <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextField label="ID" value={selectedProject.id} onChange={(id) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, id } : item) }))} /></div><button type="button" onClick={() => removeAt('projects', selectedIndex)} className="mb-0.5 rounded-md p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={16} /></button></div>
              <LocalizedField label={language === 'zh' ? '项目名称' : 'Title'} value={selectedProject.title} onChange={(title) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, title } : item) }))} />
              <LocalizedField label={language === 'zh' ? '分类' : 'Category'} value={selectedProject.category} onChange={(category) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, category } : item) }))} />
              {(['summary', 'background', 'motivation', 'problem'] as const).map((key) => <LocalizedField key={key} label={key} value={selectedProject[key]} multiline onChange={(value) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, [key]: value } : item) }))} />)}
              {(['features', 'role', 'challenges', 'solutions', 'next'] as const).map((key) => <div key={key} className="grid gap-3 sm:grid-cols-2"><TextField label={`${key}（中文，每行一项）`} value={joinLines(selectedProject[key].zh)} onChange={(value) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, [key]: { ...item[key], zh: lines(value) } } : item) }))} multiline /><TextField label={`${key} (English, one item per line)`} value={joinLines(selectedProject[key].en)} onChange={(value) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, [key]: { ...item[key], en: lines(value) } } : item) }))} multiline /></div>)}
              <LocalizedField label={language === 'zh' ? '当前状态' : 'Status'} value={selectedProject.status} onChange={(statusValue) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, status: statusValue } : item) }))} />
              <TextField label={language === 'zh' ? '技术标签（逗号分隔）' : 'Tech tags (comma separated)'} value={selectedProject.tech.join(', ')} onChange={(value) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, tech: csv(value) } : item) }))} />
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label={language === 'zh' ? '截图地址' : 'Screenshot URL'} value={selectedProject.screenshot ?? ''} onChange={(screenshot) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, screenshot } : item) }))} />
                <TextField label="GitHub" value={selectedProject.github ?? ''} onChange={(github) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, github } : item) }))} />
                <TextField label={language === 'zh' ? '在线体验' : 'Live URL'} value={selectedProject.live ?? ''} onChange={(live) => mutate((current) => ({ ...current, projects: current.projects.map((item, index) => index === selectedIndex ? { ...item, live } : item) }))} />
              </div>
            </div>}
          </div>
        </section>}

        {section === 'experiences' && <section className={panelClass}>
          <SectionHeader title={language === 'zh' ? '经历管理' : 'Experience Management'} description={language === 'zh' ? '区分工作、项目和学习经历，避免把个人练习写成正式职位。' : 'Keep work, project, and learning experiences clearly separated.'} addLabel={language === 'zh' ? '新增经历' : 'Add Experience'} onAdd={() => mutate((current) => ({ ...current, experiences: [...current.experiences, emptyExperience()] }))} />
          <div className="lg:flex">
            <ItemRail items={draft.experiences.map((item) => ({ id: item.id, label: item.title[language] }))} selected={selectedIndex} onSelect={setSelectedIndex} />
            {selectedExperience && <div className="min-w-0 flex-1 space-y-4 p-5">
              <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextField label="ID" value={selectedExperience.id} onChange={(id) => mutate((current) => ({ ...current, experiences: current.experiences.map((item, index) => index === selectedIndex ? { ...item, id } : item) }))} /></div><button type="button" onClick={() => removeAt('experiences', selectedIndex)} className="mb-0.5 rounded-md p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={16} /></button></div>
              {(['type', 'title', 'context', 'period', 'summary', 'learning', 'status'] as const).map((key) => <LocalizedField key={key} label={key} value={selectedExperience[key]} multiline={['summary', 'learning'].includes(key)} onChange={(value) => mutate((current) => ({ ...current, experiences: current.experiences.map((item, index) => index === selectedIndex ? { ...item, [key]: value } : item) }))} />)}
              <div className="grid gap-3 sm:grid-cols-2"><TextField label="职责（中文，每行一项）" value={joinLines(selectedExperience.responsibilities.zh)} onChange={(value) => mutate((current) => ({ ...current, experiences: current.experiences.map((item, index) => index === selectedIndex ? { ...item, responsibilities: { ...item.responsibilities, zh: lines(value) } } : item) }))} multiline /><TextField label="Responsibilities (English)" value={joinLines(selectedExperience.responsibilities.en)} onChange={(value) => mutate((current) => ({ ...current, experiences: current.experiences.map((item, index) => index === selectedIndex ? { ...item, responsibilities: { ...item.responsibilities, en: lines(value) } } : item) }))} multiline /></div>
              <TextField label={language === 'zh' ? '工具（逗号分隔）' : 'Tools (comma separated)'} value={selectedExperience.tools.join(', ')} onChange={(value) => mutate((current) => ({ ...current, experiences: current.experiences.map((item, index) => index === selectedIndex ? { ...item, tools: csv(value) } : item) }))} />
            </div>}
          </div>
        </section>}

        {section === 'skills' && <section className={panelClass}>
          <SectionHeader title={language === 'zh' ? '技能管理' : 'Skills Management'} description={language === 'zh' ? '先维护技能分类，再在分类中新增具体技能和使用场景。' : 'Manage skill groups, then add individual skills and real use cases.'} addLabel={language === 'zh' ? '新增分类' : 'Add Group'} onAdd={() => mutate((current) => ({ ...current, skillGroups: [...current.skillGroups, emptySkillGroup()] }))} />
          <div className="lg:flex">
            <ItemRail items={draft.skillGroups.map((item) => ({ id: item.id, label: item.title[language] }))} selected={selectedIndex} onSelect={(index) => { setSelectedIndex(index); setSelectedSkillIndex(0); }} />
            {selectedGroup && <div className="min-w-0 flex-1 space-y-4 p-5">
              <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextField label="ID" value={selectedGroup.id} onChange={(id) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, index) => index === selectedIndex ? { ...item, id } : item) }))} /></div><button type="button" onClick={() => removeAt('skillGroups', selectedIndex)} className="mb-0.5 rounded-md p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={16} /></button></div>
              <LocalizedField label={language === 'zh' ? '分类名称' : 'Group Title'} value={selectedGroup.title} onChange={(title) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, index) => index === selectedIndex ? { ...item, title } : item) }))} />
              <LocalizedField label={language === 'zh' ? '分类说明' : 'Description'} value={selectedGroup.description} multiline onChange={(description) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, index) => index === selectedIndex ? { ...item, description } : item) }))} />
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-white/10">{selectedGroup.skills.map((skill, index) => <button key={`${skill.name.zh}-${index}`} type="button" onClick={() => setSelectedSkillIndex(index)} className={`rounded-md px-3 py-2 text-xs ${selectedSkillIndex === index ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{skill.name[language]}</button>)}<button type="button" onClick={() => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, index) => index === selectedIndex ? { ...item, skills: [...item.skills, emptySkill()] } : item) }))} className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500"><ListPlus size={13} />{language === 'zh' ? '技能' : 'Skill'}</button></div>
              {selectedSkill && <div className="space-y-4 rounded-lg bg-slate-50 p-4 dark:bg-black/20">
                <LocalizedField label={language === 'zh' ? '技能名称' : 'Skill Name'} value={selectedSkill.name} onChange={(name) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, groupIndex) => groupIndex === selectedIndex ? { ...item, skills: item.skills.map((skill, skillIndex) => skillIndex === selectedSkillIndex ? { ...skill, name } : skill) } : item) }))} />
                <label className={labelClass}>{language === 'zh' ? '熟悉程度' : 'Level'}<select value={selectedSkill.level} onChange={(event) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, groupIndex) => groupIndex === selectedIndex ? { ...item, skills: item.skills.map((skill, skillIndex) => skillIndex === selectedSkillIndex ? { ...skill, level: event.target.value as PublicSkill['level'] } : skill) } : item) }))} className={fieldClass}><option value="expert">精通 expert</option><option value="proficient">熟练 proficient</option><option value="familiar">熟悉 familiar</option><option value="basic">了解 basic</option><option value="learning">学习中 learning</option></select></label>
                <div className="grid gap-3 sm:grid-cols-2"><TextField label="使用场景（中文）" value={joinLines(selectedSkill.useCases.zh)} multiline onChange={(value) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, groupIndex) => groupIndex === selectedIndex ? { ...item, skills: item.skills.map((skill, skillIndex) => skillIndex === selectedSkillIndex ? { ...skill, useCases: { ...skill.useCases, zh: lines(value) } } : skill) } : item) }))} /><TextField label="Use Cases (English)" value={joinLines(selectedSkill.useCases.en)} multiline onChange={(value) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, groupIndex) => groupIndex === selectedIndex ? { ...item, skills: item.skills.map((skill, skillIndex) => skillIndex === selectedSkillIndex ? { ...skill, useCases: { ...skill.useCases, en: lines(value) } } : skill) } : item) }))} /></div>
                <LocalizedField label={language === 'zh' ? '最近使用' : 'Last Used'} value={selectedSkill.lastUsed} onChange={(lastUsed) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, groupIndex) => groupIndex === selectedIndex ? { ...item, skills: item.skills.map((skill, skillIndex) => skillIndex === selectedSkillIndex ? { ...skill, lastUsed } : skill) } : item) }))} />
                <TextField label={language === 'zh' ? '关联项目 ID（逗号分隔）' : 'Project IDs (comma separated)'} value={selectedSkill.projects.join(', ')} onChange={(value) => mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, groupIndex) => groupIndex === selectedIndex ? { ...item, skills: item.skills.map((skill, skillIndex) => skillIndex === selectedSkillIndex ? { ...skill, projects: csv(value) } : skill) } : item) }))} />
                <button type="button" onClick={() => { mutate((current) => ({ ...current, skillGroups: current.skillGroups.map((item, groupIndex) => groupIndex === selectedIndex ? { ...item, skills: item.skills.filter((_, skillIndex) => skillIndex !== selectedSkillIndex) } : item) })); setSelectedSkillIndex(0); }} className="inline-flex items-center gap-1 text-xs text-red-500"><Trash2 size={13} />{language === 'zh' ? '删除这项技能' : 'Delete Skill'}</button>
              </div>}
            </div>}
          </div>
        </section>}

        {section === 'safari' && <section className={panelClass}>
          <SectionHeader title={language === 'zh' ? 'Safari 固定收藏' : 'Safari Pinned Favorites'} description={language === 'zh' ? '这里发布的收藏会出现在所有访问者的 Safari 起始页。' : 'Published favorites appear on every visitor’s Safari start page.'} addLabel={language === 'zh' ? '新增收藏' : 'Add Favorite'} onAdd={() => mutate((current) => ({ ...current, safariBookmarks: [...current.safariBookmarks, emptyBookmark()] }))} />
          <div className="lg:flex"><ItemRail items={draft.safariBookmarks.map((item) => ({ id: item.id, label: item.title[language] }))} selected={selectedIndex} onSelect={setSelectedIndex} />{selectedBookmark && <div className="min-w-0 flex-1 space-y-4 p-5">
            <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextField label="ID" value={selectedBookmark.id} onChange={(id) => mutate((current) => ({ ...current, safariBookmarks: current.safariBookmarks.map((item, index) => index === selectedIndex ? { ...item, id } : item) }))} /></div><button type="button" onClick={() => removeAt('safariBookmarks', selectedIndex)} className="mb-0.5 rounded-md p-2.5 text-red-500"><Trash2 size={16} /></button></div>
            {(['title', 'description', 'category'] as const).map((key) => <LocalizedField key={key} label={key} value={selectedBookmark[key]} multiline={key === 'description'} onChange={(value) => mutate((current) => ({ ...current, safariBookmarks: current.safariBookmarks.map((item, index) => index === selectedIndex ? { ...item, [key]: value } : item) }))} />)}
            <TextField label={language === 'zh' ? '目标网站地址' : 'Target URL'} value={selectedBookmark.targetUrl} onChange={(targetUrl) => mutate((current) => ({ ...current, safariBookmarks: current.safariBookmarks.map((item, index) => index === selectedIndex ? { ...item, targetUrl } : item) }))} />
            <TextField label={language === 'zh' ? '图标地址' : 'Icon URL'} value={selectedBookmark.icon ?? ''} onChange={(icon) => mutate((current) => ({ ...current, safariBookmarks: current.safariBookmarks.map((item, index) => index === selectedIndex ? { ...item, icon } : item) }))} />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(selectedBookmark.pinned)} onChange={(event) => mutate((current) => ({ ...current, safariBookmarks: current.safariBookmarks.map((item, index) => index === selectedIndex ? { ...item, pinned: event.target.checked } : item) }))} />{language === 'zh' ? '固定在所有访问者的收藏区' : 'Pin for every visitor'}</label>
          </div>}</div>
        </section>}

        {section === 'music' && <section className={panelClass}>
          <SectionHeader title={language === 'zh' ? '公开音乐列表' : 'Published Music'} description={language === 'zh' ? '直接音频地址可站内播放；Spotify、Apple Music 等请填写官方 embedUrl。' : 'Direct audio URLs play natively; use official embed URLs for supported platforms.'} addLabel={language === 'zh' ? '新增音乐' : 'Add Track'} onAdd={() => mutate((current) => ({ ...current, mediaTracks: [...current.mediaTracks, emptyTrack()] }))} />
          <div className="lg:flex"><ItemRail items={draft.mediaTracks.map((item) => ({ id: item.id, label: item.title }))} selected={selectedIndex} onSelect={setSelectedIndex} />{selectedTrack && <div className="min-w-0 flex-1 space-y-4 p-5">
            <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextField label="ID" value={selectedTrack.id} onChange={(id) => mutate((current) => ({ ...current, mediaTracks: current.mediaTracks.map((item, index) => index === selectedIndex ? { ...item, id } : item) }))} /></div><button type="button" onClick={() => removeAt('mediaTracks', selectedIndex)} className="mb-0.5 rounded-md p-2.5 text-red-500"><Trash2 size={16} /></button></div>
            <div className="grid gap-3 sm:grid-cols-2"><TextField label={language === 'zh' ? '歌曲名' : 'Title'} value={selectedTrack.title} onChange={(title) => mutate((current) => ({ ...current, mediaTracks: current.mediaTracks.map((item, index) => index === selectedIndex ? { ...item, title } : item) }))} /><TextField label={language === 'zh' ? '作者' : 'Artist'} value={selectedTrack.artist} onChange={(artist) => mutate((current) => ({ ...current, mediaTracks: current.mediaTracks.map((item, index) => index === selectedIndex ? { ...item, artist } : item) }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>{language === 'zh' ? '平台' : 'Platform'}<select value={selectedTrack.platform} onChange={(event) => mutate((current) => ({ ...current, mediaTracks: current.mediaTracks.map((item, index) => index === selectedIndex ? { ...item, platform: event.target.value as MediaTrack['platform'] } : item) }))} className={fieldClass}>{['direct', 'netease', 'kugou', 'spotify', 'apple'].map((value) => <option key={value}>{value}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '播放方式' : 'Playback'}<select value={selectedTrack.playback} onChange={(event) => mutate((current) => ({ ...current, mediaTracks: current.mediaTracks.map((item, index) => index === selectedIndex ? { ...item, playback: event.target.value as MediaTrack['playback'] } : item) }))} className={fieldClass}>{['native', 'embed', 'external'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
            {(['sourceUrl', 'embedUrl', 'externalUrl'] as const).map((key) => <TextField key={key} label={key} value={selectedTrack[key] ?? ''} onChange={(value) => mutate((current) => ({ ...current, mediaTracks: current.mediaTracks.map((item, index) => index === selectedIndex ? { ...item, [key]: value } : item) }))} />)}
          </div>}</div>
        </section>}

        {section === 'desktop' && <section className={panelClass}>
          <SectionHeader title={language === 'zh' ? '桌面快捷方式' : 'Desktop Shortcuts'} description={language === 'zh' ? '添加应用入口或公开网址，不会改变现有桌面图标和动画。' : 'Add app shortcuts or public URLs without changing the existing desktop icons or animation.'} addLabel={language === 'zh' ? '新增快捷方式' : 'Add Shortcut'} onAdd={() => mutate((current) => ({ ...current, desktopShortcuts: [...current.desktopShortcuts, emptyShortcut()] }))} />
          <div className="lg:flex"><ItemRail items={draft.desktopShortcuts.map((item) => ({ id: item.id, label: item.label[language] }))} selected={selectedIndex} onSelect={setSelectedIndex} />{selectedShortcut && <div className="min-w-0 flex-1 space-y-4 p-5">
            <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextField label="ID" value={selectedShortcut.id} onChange={(id) => mutate((current) => ({ ...current, desktopShortcuts: current.desktopShortcuts.map((item, index) => index === selectedIndex ? { ...item, id } : item) }))} /></div><button type="button" onClick={() => removeAt('desktopShortcuts', selectedIndex)} className="mb-0.5 rounded-md p-2.5 text-red-500"><Trash2 size={16} /></button></div>
            <LocalizedField label={language === 'zh' ? '名称' : 'Label'} value={selectedShortcut.label} onChange={(label) => mutate((current) => ({ ...current, desktopShortcuts: current.desktopShortcuts.map((item, index) => index === selectedIndex ? { ...item, label } : item) }))} />
            <TextField label={language === 'zh' ? '图标地址' : 'Icon URL'} value={selectedShortcut.icon} onChange={(icon) => mutate((current) => ({ ...current, desktopShortcuts: current.desktopShortcuts.map((item, index) => index === selectedIndex ? { ...item, icon } : item) }))} />
            <div className="grid gap-3 sm:grid-cols-2"><TextField label={language === 'zh' ? '应用 ID（与网址二选一）' : 'App ID (or URL)'} value={selectedShortcut.appId ?? ''} onChange={(appId) => mutate((current) => ({ ...current, desktopShortcuts: current.desktopShortcuts.map((item, index) => index === selectedIndex ? { ...item, appId } : item) }))} /><TextField label={language === 'zh' ? '目标网址' : 'Target URL'} value={selectedShortcut.targetUrl ?? ''} onChange={(targetUrl) => mutate((current) => ({ ...current, desktopShortcuts: current.desktopShortcuts.map((item, index) => index === selectedIndex ? { ...item, targetUrl } : item) }))} /></div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedShortcut.enabled} onChange={(event) => mutate((current) => ({ ...current, desktopShortcuts: current.desktopShortcuts.map((item, index) => index === selectedIndex ? { ...item, enabled: event.target.checked } : item) }))} />{language === 'zh' ? '显示在桌面' : 'Show on desktop'}</label>
          </div>}</div>
        </section>}
      </main>
    </div>
  </div>;
};
