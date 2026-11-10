import React, { useMemo, useState } from 'react';
import { FileCode, FileJson, Folder, FolderOpen, Search, GitBranch, Settings, X, ChevronRight, ChevronDown, Monitor, Layout } from 'lucide-react';
import { useI18n } from '../../i18n';
import { vscodeLabels } from '../../data/systemContent';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

const createFileSystem = (language: 'zh' | 'en'): FileNode[] => [
  {
    id: 'src', name: 'src', type: 'folder', children: [
      {
        id: 'profile', name: 'profile', type: 'folder', children: [
          {
            id: 'about.md', name: 'about.md', type: 'file', language: 'markdown',
            content: language === 'zh'
              ? '# 你的名字\n\n在 src/data/portfolioData.ts 填写公开简介。'
              : '# Your name\n\nEdit src/data/portfolioData.ts to add your public profile.',
          },
        ],
      },
      {
        id: 'projects', name: 'projects', type: 'folder', children: [
          {
            id: 'start.md', name: 'start.md', type: 'file', language: 'markdown',
            content: language === 'zh'
              ? '# 项目\n\n在 src/data/portfolioData.ts 添加项目。'
              : '# Projects\n\nAdd projects in src/data/portfolioData.ts.',
          },
        ],
      },
    ],
  },
];

const FileTree: React.FC<{ node: FileNode; level: number; onSelect: (file: FileNode) => void; activeFileId: string | null }> = ({ node, level, onSelect, activeFileId }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className="flex cursor-pointer items-center px-2 py-1 text-[#cccccc] transition-colors hover:bg-[#2a2d2e] hover:text-white"
          style={{ paddingLeft: `${level * 12 + 4}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronDown size={14} className="mr-1 opacity-80" /> : <ChevronRight size={14} className="mr-1 opacity-80" />}
          {isOpen ? <FolderOpen size={14} className="mr-2 text-blue-400" /> : <Folder size={14} className="mr-2 text-blue-400" />}
          <span className="truncate text-[13px] font-medium">{node.name}</span>
        </div>
        {isOpen && node.children?.map((child) => (
          <FileTree key={child.id} node={child} level={level + 1} onSelect={onSelect} activeFileId={activeFileId} />
        ))}
      </div>
    );
  }

  const getIcon = (name: string) => {
    if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode size={14} className="mr-2 text-[#4d93e9]" />;
    if (name.endsWith('.css')) return <Layout size={14} className="mr-2 text-[#42a5f5]" />;
    if (name.endsWith('.json')) return <FileJson size={14} className="mr-2 text-[#fbc02d]" />;
    if (name.endsWith('.md')) return <Monitor size={14} className="mr-2 text-[#90a4ae]" />;
    return <FileCode size={14} className="mr-2 text-gray-400" />;
  };

  return (
    <div
      className={`flex cursor-pointer items-center px-2 py-1 text-[#cccccc] transition-colors hover:text-white ${activeFileId === node.id ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e]'}`}
      style={{ paddingLeft: `${level * 12 + 20}px` }}
      onClick={() => onSelect(node)}
    >
      {getIcon(node.name)}
      <span className="truncate text-[13px]">{node.name}</span>
    </div>
  );
};

export const VSCodeApp: React.FC = () => {
  const { language } = useI18n();
  const labels = vscodeLabels[language];
  const fileSystem = useMemo(() => createFileSystem(language), [language]);
  const [activeFileId, setActiveFileId] = useState('README.md');

  const findFile = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id && node.type === 'file') return node;
      if (node.children) {
        const result = findFile(node.children, id);
        if (result) return result;
      }
    }
    return null;
  };

  const activeFile = findFile(fileSystem, activeFileId) ?? fileSystem[1];

  const renderCode = (fileContent: string) => (
    fileContent.split('\n').map((line, index) => (
      <div key={`${index}-${line}`} className="table-row hover:bg-[#2f3133]">
        <span className="table-cell w-10 select-none pr-6 text-right font-mono text-[13px] text-[#858585]">{index + 1}</span>
        <span className="table-cell whitespace-pre font-mono text-[13px] text-[#d4d4d4]">{line}</span>
      </div>
    ))
  );

  return (
    <div className="flex h-full w-full overflow-hidden rounded-b-lg bg-[#1e1e1e] font-sans text-[#cccccc] selection:bg-[#264f78]">
      <div className="flex w-12 flex-col items-center space-y-4 border-r border-[#1e1e1e] bg-[#333333] py-3">
        <FileCode size={24} className="cursor-pointer border-l-2 border-white p-1 text-white opacity-100" />
        <Search size={24} className="cursor-pointer p-1 text-[#858585] transition-opacity hover:text-white" />
        <GitBranch size={24} className="cursor-pointer p-1 text-[#858585] transition-opacity hover:text-white" />
        <div className="flex-grow" />
        <Settings size={24} className="mb-2 cursor-pointer p-1 text-[#858585] transition-opacity hover:text-white" />
      </div>

      <aside className="flex w-60 flex-col border-r border-[#1e1e1e] bg-[#252526]">
        <div className="ellipsis flex h-9 items-center overflow-hidden whitespace-nowrap px-4 text-[11px] font-bold uppercase tracking-wider text-[#bbbbbb]">
          {labels.explorer}
        </div>
        <div className="custom-scrollbar flex-grow overflow-y-auto">
          <div className="px-1 py-1">
            <div className="flex cursor-pointer items-center bg-[#37373d] px-1 py-1 text-xs font-bold text-white">
              <ChevronDown size={12} className="mr-1" />
              {labels.root}
            </div>
            {fileSystem.map((node) => (
              <FileTree key={node.id} node={node} level={0} onSelect={(file) => setActiveFileId(file.id)} activeFileId={activeFile?.id || null} />
            ))}
          </div>
        </div>
      </aside>

      <main className="flex flex-grow flex-col bg-[#1e1e1e]">
        <div className="no-scrollbar flex h-9 items-center overflow-x-auto bg-[#252526]">
          {activeFile && (
            <div className="group flex h-full min-w-[140px] cursor-pointer items-center justify-between border-t-2 border-[#007acc] bg-[#1e1e1e] px-3 pr-2 text-[13px] text-white">
              <span className="flex items-center">
                <FileCode size={14} className="mr-2 text-[#4d93e9]" />
                {activeFile.name}
              </span>
              <X size={14} className="rounded-sm p-[1px] opacity-0 transition-all hover:bg-[#333] group-hover:opacity-100" />
            </div>
          )}
        </div>

        <div className="flex h-6 items-center bg-[#1e1e1e] px-4 text-[13px] text-[#8b8b8b] shadow-[0_1px_0_#2b2b2b]">
          src <ChevronRight size={12} className="mx-1 opacity-50" /> {activeFile?.name}
        </div>

        <div className="custom-scrollbar relative flex-grow overflow-auto">
          <div className="p-2 pt-4">{renderCode(activeFile?.content || '')}</div>
        </div>

        <div className="z-10 flex h-6 select-none items-center justify-between bg-[#007acc] px-3 text-[12px] text-white">
          <div className="flex items-center space-x-3">
            <span className="flex cursor-pointer items-center rounded px-1 transition-colors hover:bg-white/20">
              <GitBranch size={10} className="mr-1" /> main
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="rounded px-1 transition-colors hover:bg-white/20">Ln 7, Col 24</span>
            <span className="rounded px-1 transition-colors hover:bg-white/20">UTF-8</span>
            <span className="rounded px-1 transition-colors hover:bg-white/20">{activeFile?.language || 'text'}</span>
            <div className="cursor-pointer rounded p-1 hover:bg-white/20"><Settings size={12} /></div>
          </div>
        </div>
      </main>
    </div>
  );
};
