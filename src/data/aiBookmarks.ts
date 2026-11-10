import { publicProjects, type PortfolioLanguage, type PublicProject } from './portfolioData';

export interface SafariBookmark {
  id: string;
  title: string;
  /** The verified external destination. Empty means unresolved and never falls back to ai-bot.cn. */
  targetUrl: string;
  /** The public source page used during catalog synchronization. Never used for click navigation. */
  sourcePageUrl?: string;
  linkStatus: 'valid' | 'unresolved' | 'invalid';
  embedStatus?: 'allowed' | 'blocked' | 'unknown';
  /** Optional safe embed URL when it differs from the public destination. */
  embedUrl?: string;
  descriptionZh: string;
  descriptionEn: string;
  categoryId: string;
  subcategoryId?: string;
  icon?: string;
  tags?: string[];
  /** Always visible in the Safari start-page favorites for every visitor. */
  pinned?: boolean;
  custom?: boolean;
}

export interface BookmarkSubcategory {
  id: string;
  nameZh: string;
  nameEn: string;
}

export interface BookmarkCategory {
  id: string;
  nameZh: string;
  nameEn: string;
  subcategories: BookmarkSubcategory[];
}


export const AI_DIRECTORY_VERSION = 2;

export const bookmarkCategories: BookmarkCategory[] = [
  { id: 'projects', nameZh: '我的项目', nameEn: 'My Projects', subcategories: [{ id: 'project-sites', nameZh: '项目网站', nameEn: 'Project Sites' }] },
  { id: 'life', nameZh: '人生', nameEn: 'Life', subcategories: [] },
  { id: 'writing', nameZh: 'AI 写作', nameEn: 'AI Writing', subcategories: [{ id: 'creative', nameZh: '内容创作', nameEn: 'Creative Writing' }, { id: 'academic', nameZh: '学术写作', nameEn: 'Academic Writing' }] },
  { id: 'image', nameZh: 'AI 图像', nameEn: 'AI Image', subcategories: [{ id: 'generate', nameZh: '图片生成', nameEn: 'Image Generation' }, { id: 'edit', nameZh: '图片处理', nameEn: 'Image Editing' }] },
  { id: 'video', nameZh: 'AI 视频', nameEn: 'AI Video', subcategories: [{ id: 'create', nameZh: '视频创作', nameEn: 'Video Creation' }] },
  { id: 'office', nameZh: 'AI 办公', nameEn: 'AI Office', subcategories: [{ id: 'documents', nameZh: '文档与演示', nameEn: 'Docs & Slides' }] },
  { id: 'agent', nameZh: 'AI 智能体', nameEn: 'AI Agents', subcategories: [{ id: 'workflow', nameZh: '工作流', nameEn: 'Workflows' }] },
  { id: 'chat', nameZh: 'AI 聊天', nameEn: 'AI Chat', subcategories: [{ id: 'assistant', nameZh: '对话助手', nameEn: 'Assistants' }] },
  { id: 'coding', nameZh: 'AI 编程', nameEn: 'AI Coding', subcategories: [{ id: 'ide', nameZh: '编程助手', nameEn: 'Coding Assistants' }] },
  { id: 'design', nameZh: 'AI 设计', nameEn: 'AI Design', subcategories: [{ id: 'graphics', nameZh: '视觉设计', nameEn: 'Visual Design' }] },
  { id: 'audio', nameZh: 'AI 音频', nameEn: 'AI Audio', subcategories: [{ id: 'voice', nameZh: '语音与音乐', nameEn: 'Voice & Music' }] },
  { id: 'search', nameZh: 'AI 搜索', nameEn: 'AI Search', subcategories: [{ id: 'research', nameZh: '研究搜索', nameEn: 'Research Search' }] },
  { id: 'development', nameZh: '开发平台', nameEn: 'Developer Platforms', subcategories: [{ id: 'models', nameZh: '模型与 API', nameEn: 'Models & APIs' }] },
  { id: 'learning', nameZh: 'AI 学习', nameEn: 'AI Learning', subcategories: [{ id: 'courses', nameZh: '学习资源', nameEn: 'Learning Resources' }] },
  { id: 'models', nameZh: '训练模型', nameEn: 'AI Models', subcategories: [{ id: 'open', nameZh: '开放模型', nameEn: 'Open Models' }] },
  { id: 'model-evaluation', nameZh: '模型评测', nameEn: 'Model Evaluation', subcategories: [] },
  { id: 'detection', nameZh: '内容检测', nameEn: 'Content Detection', subcategories: [{ id: 'check', nameZh: '检测与优化', nameEn: 'Check & Optimize' }] },
  { id: 'prompts', nameZh: '提示指令', nameEn: 'Prompt Tools', subcategories: [{ id: 'prompting', nameZh: '提示词工具', nameEn: 'Prompting' }] },
  { id: 'side-hustle', nameZh: 'AI 副业工具', nameEn: 'AI Side Hustle', subcategories: [] },
];

export const aiBookmarks: SafariBookmark[] = [];

/** Real site icons, stored locally so they load even where third-party favicon services are blocked. */
export const ownSiteIcons: Partial<Record<string, string>> = {};
const projectIcons = ownSiteIcons;

export const getProjectBookmarks = (language: PortfolioLanguage, projects: PublicProject[] = publicProjects): SafariBookmark[] => projects
  .filter((project) => Boolean(project.live))
  .map((project) => ({
    id: project.id,
    title: project.title[language],
    targetUrl: project.live as string,
    linkStatus: 'valid',
    embedStatus: 'allowed',
    descriptionZh: project.summary.zh,
    descriptionEn: project.summary.en,
    categoryId: 'projects',
    subcategoryId: 'project-sites',
    icon: projectIcons[project.id],
    tags: ['project', ...project.tech],
    pinned: true,
  }));

export const bookmarkCategoryCount = bookmarkCategories.length;
export const bookmarkSubcategoryCount = bookmarkCategories.reduce((total, category) => total + category.subcategories.length, 0);
