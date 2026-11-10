/**
 * Public template content. Replace these placeholders with your own public information.
 * Nothing from the original author's profile, projects, or contact details is bundled here.
 */
export type PortfolioLanguage = 'zh' | 'en';
export type LocalizedText = Record<PortfolioLanguage, string>;
export type SkillLevel = 'expert' | 'proficient' | 'familiar' | 'basic' | 'learning' | 'regular' | 'working';

export interface PublicProfile {
  name: string;
  headline: LocalizedText;
  location: LocalizedText;
  introduction: Record<PortfolioLanguage, string[]>;
  focusTitle: LocalizedText;
  focus: LocalizedText;
  links: { github: string; x: string; website?: string };
  highlights?: { value: string; label: LocalizedText }[];
  lifeSkills?: Record<PortfolioLanguage, string[]>;
  hobbies?: Record<PortfolioLanguage, string>;
}

export interface PublicProject {
  id: string;
  title: LocalizedText;
  category: LocalizedText;
  summary: LocalizedText;
  background: LocalizedText;
  motivation: LocalizedText;
  problem: LocalizedText;
  features: Record<PortfolioLanguage, string[]>;
  role: Record<PortfolioLanguage, string[]>;
  challenges: Record<PortfolioLanguage, string[]>;
  solutions: Record<PortfolioLanguage, string[]>;
  status: LocalizedText;
  next: Record<PortfolioLanguage, string[]>;
  tech: string[];
  screenshot?: string;
  github?: string;
  live?: string;
}

export interface PublicExperience {
  id: string;
  type: LocalizedText;
  title: LocalizedText;
  context: LocalizedText;
  period: LocalizedText;
  summary: LocalizedText;
  responsibilities: Record<PortfolioLanguage, string[]>;
  tools: string[];
  learning: LocalizedText;
  status: LocalizedText;
}

export interface PublicSkill {
  name: LocalizedText;
  level: SkillLevel;
  useCases: Record<PortfolioLanguage, string[]>;
  projects: string[];
  lastUsed: LocalizedText;
}

export interface PublicSkillGroup {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  skills: PublicSkill[];
}

export const publicProfile: PublicProfile = {
  name: '你的名字',
  headline: { zh: '在这里填写你的介绍', en: 'Add your headline here' },
  location: { zh: '你的城市', en: 'Your location' },
  introduction: {
    zh: ['在 src/data/portfolioData.ts 中填写你的公开简介。'],
    en: ['Add your public introduction in src/data/portfolioData.ts.'],
  },
  focusTitle: { zh: '现在在做什么', en: 'Current focus' },
  focus: { zh: '在这里填写你正在做的事。', en: 'Add what you are working on.' },
  links: { github: 'https://github.com/', x: 'https://x.com/' },
  highlights: [],
  hobbies: { zh: '', en: '' },
  lifeSkills: { zh: [], en: [] },
};

export const publicProjects: PublicProject[] = [];
export const publicExperience: PublicExperience[] = [];
export const publicSkillGroups: PublicSkillGroup[] = [];

export const localize = (value: LocalizedText, language: PortfolioLanguage) => value[language];
export const projectTitleById = (id: string, language: PortfolioLanguage) =>
  publicProjects.find((project) => project.id === id)?.title[language] ?? id;
