import type { Language } from '../i18n';

type TerminalCommand = 'help' | 'whoami' | 'resume' | 'projects' | 'skills' | 'contact' | 'hobbies' | 'crypto';
type TerminalCopy = { welcome: string[]; prompt: string; responses: string[]; commands: Record<TerminalCommand, string> };

export const terminalContent: Record<Language, TerminalCopy> = {
  zh: {
    welcome: ['欢迎使用你的桌面网站。', '输入 help 查看命令。'],
    prompt: 'you@desktop:~$',
    responses: ['未知命令。输入 help 查看帮助。'],
    commands: {
      help: '可用命令：whoami · resume · projects · skills · contact · hobbies · crypto · music · games · tv · clear',
      whoami: '在 src/data/systemContent.ts 中填写你的介绍。',
      resume: '在这里填写你的简历摘要。',
      projects: '打开 Dock 中的项目应用，查看你的项目。',
      skills: '在这里填写你的技能。',
      contact: '在 src/data/portfolioData.ts 中设置公开联系方式。',
      hobbies: '在这里填写你的爱好。',
      crypto: '这个命令可以改成你自己的主题。',
    },
  },
  en: {
    welcome: ['Welcome to your desktop site.', 'Type help to see commands.'],
    prompt: 'you@desktop:~$',
    responses: ['Unknown command. Type help for help.'],
    commands: {
      help: 'Commands: whoami · resume · projects · skills · contact · hobbies · crypto · music · games · tv · clear',
      whoami: 'Add your introduction in src/data/systemContent.ts.',
      resume: 'Add your resume summary here.',
      projects: 'Open the Projects app in the Dock.',
      skills: 'Add your skills here.',
      contact: 'Set public contact links in src/data/portfolioData.ts.',
      hobbies: 'Add your hobbies here.',
      crypto: 'Change this command to a topic of your choice.',
    },
  },
};

export const vscodeLabels: Record<Language, { explorer: string; root: string }> = {
  zh: { explorer: '资源管理器：MY-DESKTOP', root: 'MY-DESKTOP' },
  en: { explorer: 'EXPLORER: MY-DESKTOP', root: 'MY-DESKTOP' },
};
