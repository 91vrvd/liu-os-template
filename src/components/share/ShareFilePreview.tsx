import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { FileQuestion, LoaderCircle } from 'lucide-react';
import DOMPurify from 'dompurify';
import { parseLocalFile, toDocument } from '../../lib/documentParsers';
import { deleteBlob, saveBlob, type LocalDocument } from '../../lib/documentStore';
import type { ShareInboxItem } from '../../types/share';
import { useI18n } from '../../i18n';
import {
  DocxPreview,
  ImagePreview,
  PdfPreview,
  PptxPreview,
  SheetPreview,
} from '../apps/notes/DocumentViewers';

interface ShareFilePreviewProps {
  item: ShareInboxItem;
  getFile: (item: ShareInboxItem) => Promise<File | null>;
}

export const ShareFilePreview: React.FC<ShareFilePreviewProps> = ({ item, getFile }) => {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [archiveEntries, setArchiveEntries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const tempBlobId = useMemo(() => `share-preview:${item.id}`, [item.id]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);
    setFile(null);
    setDocument(null);
    setText('');
    setHtml('');
    setArchiveEntries([]);
    void (async () => {
      try {
        const nextFile = await getFile(item);
        if (!active || !nextFile) throw new Error('share-file-missing');
        setFile(nextFile);
        objectUrl = URL.createObjectURL(nextFile);
        setUrl(objectUrl);
        if (item.previewKind === 'office' || item.previewKind === 'pdf' || item.previewKind === 'image') {
          await saveBlob(tempBlobId, nextFile);
          const parsed = await parseLocalFile(nextFile);
          if (!active) return;
          setDocument(toDocument(nextFile, parsed, tempBlobId));
        } else if (item.previewKind === 'text') {
          const raw = (await nextFile.text()).slice(0, 1_000_000);
          if (/\.html?$/i.test(nextFile.name) || nextFile.type === 'text/html') {
            setHtml(DOMPurify.sanitize(raw, {
              USE_PROFILES: { html: true },
              FORBID_TAGS: ['script', 'object', 'embed'],
              FORBID_ATTR: ['onerror', 'onload', 'onclick'],
            }));
          } else {
            setText(raw);
          }
        } else if (item.previewKind === 'archive') {
          if (nextFile.size > 256 * 1024 * 1024) throw new Error('archive-preview-too-large');
          const zip = await JSZip.loadAsync(nextFile, {
            checkCRC32: false,
            createFolders: false,
          });
          if (Object.keys(zip.files).length > 2_000) throw new Error('archive-too-many-entries');
          setArchiveEntries(Object.values(zip.files).slice(0, 2_000).map((entry) => entry.name));
        }
        if (active) setLoading(false);
      } catch {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      void deleteBlob(tempBlobId);
    };
  }, [getFile, item, tempBlobId]);

  const labels = {
    loading: t('notes.loading'),
    previewUnavailable: t('notes.previewUnavailable'),
    previous: t('notes.previous'),
    next: t('notes.next'),
    zoomIn: t('notes.zoomIn'),
    zoomOut: t('notes.zoomOut'),
    search: t('notes.searchDocument'),
    copy: t('notes.copyText'),
    fullscreen: t('notes.fullscreen'),
    download: t('notes.openOriginal'),
    rotate: t('notes.rotate'),
  };

  if (loading) {
    return <div className="flex h-full min-h-48 items-center justify-center text-slate-400"><LoaderCircle className="animate-spin" size={24} /></div>;
  }
  if (error || !file || !url) {
    return <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-slate-400"><FileQuestion size={34} /><span className="text-sm">{t('notes.previewUnavailable')}</span></div>;
  }
  if (item.previewKind === 'image' && document) {
    return <ImagePreview blobId={tempBlobId} alt={item.name} labels={labels} />;
  }
  if (item.previewKind === 'audio') {
    return <div className="flex h-full min-h-48 items-center justify-center p-5"><audio controls src={url} className="w-full max-w-xl" /></div>;
  }
  if (item.previewKind === 'video') {
    return <div className="flex h-full min-h-48 items-center justify-center bg-black p-3"><video controls playsInline src={url} className="max-h-full max-w-full" /></div>;
  }
  if (document?.kind === 'word') {
    return <DocxPreview blobId={tempBlobId} content={document.content} labels={labels} />;
  }
  if (document?.kind === 'presentation') {
    return <PptxPreview blobId={tempBlobId} labels={{ ...labels, slide: t('notes.slide'), noSlides: t('notes.noSlides') }} />;
  }
  if (document?.kind === 'spreadsheet') {
    return <SheetPreview document={document} labels={{ ...labels, sheet: t('notes.sheet'), row: t('notes.rows'), noResults: t('notes.noResults') }} />;
  }
  if (document?.kind === 'pdf') {
    return <PdfPreview blobId={tempBlobId} labels={{ ...labels, page: (page, total) => `${page} / ${total}`, noResults: t('notes.noResults') }} />;
  }
  if (html) {
    return <iframe title={item.name} sandbox="" srcDoc={html} className="h-full min-h-64 w-full border-0 bg-white" />;
  }
  if (text) {
    return <pre className="h-full min-h-64 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-slate-700 dark:text-slate-200">{text}</pre>;
  }
  if (archiveEntries.length) {
    return <div className="h-full overflow-auto p-5"><h3 className="mb-3 text-sm font-semibold">ZIP · {archiveEntries.length}</h3><ul className="space-y-1 font-mono text-xs text-slate-600 dark:text-slate-300">{archiveEntries.map((entry) => <li key={entry} className="truncate rounded px-2 py-1 odd:bg-black/[0.03] dark:odd:bg-white/[0.04]">{entry}</li>)}</ul></div>;
  }
  return <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-slate-400"><FileQuestion size={34} /><span className="text-sm">{t('notes.noPreview')}</span></div>;
};
