import { LocalDocument } from './documentStore';

const documentText = (document: LocalDocument) => `${document.title}\n\n${document.content ?? document.previewData?.text ?? ''}`.trim();

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));

export const exportJson = (documents: LocalDocument[]) => new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), documents }, null, 2)], { type: 'application/json' });

export const exportHtml = (document: LocalDocument) => new Blob([`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title></head><body><h1>${escapeHtml(document.title)}</h1><pre>${escapeHtml(documentText(document))}</pre></body></html>`], { type: 'text/html' });

export const exportDocx = async (document: LocalDocument) => {
  const docxModule = await import('docx');
  const { Document, HeadingLevel, Packer, Paragraph } = docxModule;
  const children = [
    new Paragraph({ text: document.title, heading: HeadingLevel.HEADING_1 }),
    ...(documentText(document).split(/\r?\n/).slice(2).map((line) => new Paragraph({ text: line }))),
  ];
  const output = new Document({ sections: [{ children }] });
  return Packer.toBlob(output);
};

export const exportXlsx = async (documents: LocalDocument[], language: 'zh' | 'en') => {
  const XLSXModule = await import('@e965/xlsx');
  const XLSX = XLSXModule.default ?? XLSXModule;
  const headers = language === 'zh' ? ['标题', '内容', '类型', '创建时间', '修改时间'] : ['Title', 'Content', 'Type', 'Created At', 'Updated At'];
  const rows = documents.map((document) => [document.title, document.content ?? '', document.kind, new Date(document.createdAt).toISOString(), new Date(document.updatedAt).toISOString()]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), language === 'zh' ? '备忘录' : 'Notes');
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const exportPptx = async (document: LocalDocument) => {
  const PptxModule = await import('pptxgenjs');
  const PptxGenJS = PptxModule.default ?? PptxModule;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const editableContent = document.content ?? document.previewData?.text ?? '';
  const markedSlides = editableContent.split(/^--- Slide \d+ ---\s*$/gim).map((section) => section.trim()).filter(Boolean);
  const hasSlideMarkers = /^--- Slide \d+ ---\s*$/im.test(editableContent);
  const lines = documentText(document).split(/\r?\n/).filter(Boolean);
  const chunks: string[][] = hasSlideMarkers ? markedSlides.map((section) => section.split(/\r?\n/).filter(Boolean)) : [];
  if (!chunks.length) {
    for (let index = 0; index < lines.length; index += 12) chunks.push(lines.slice(index, index + 12));
  }
  (chunks.length ? chunks : [['']]).forEach((chunk, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F7FB' };
    slide.addText(index === 0 ? document.title : `${document.title} · ${index + 1}`, { x: 0.6, y: 0.45, w: 12, h: 0.5, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: '162033', margin: 0 });
    slide.addText(chunk.join('\n'), { x: 0.75, y: 1.35, w: 11.5, h: 5.5, fontFace: 'Aptos', fontSize: 17, color: '3E4A5D', breakLine: false, valign: 'top', margin: 0.05, fit: 'shrink' });
  });
  const output = await pptx.write({ outputType: 'blob' });
  return output instanceof Blob ? output : new Blob([output as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
};

const canvasPage = (title: string, lines: string[]) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('pdf-canvas-unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#162033';
  context.font = 'bold 42px "PingFang SC", "Microsoft YaHei", sans-serif';
  context.fillText(title.slice(0, 42), 90, 110);
  context.fillStyle = '#303b4f';
  context.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
  lines.forEach((line, index) => context.fillText(line.slice(0, 72), 90, 180 + index * 38));
  return canvas.toDataURL('image/jpeg', 0.92);
};

export const exportPdf = async (document: LocalDocument) => {
  const JsPdfModule = await import('jspdf');
  const JsPDF = JsPdfModule.jsPDF;
  const pdf = new JsPDF({ unit: 'pt', format: 'a4', compress: true });
  const rawLines = documentText(document).split(/\r?\n/).flatMap((line) => {
    const chunks: string[] = [];
    for (let index = 0; index < line.length; index += 42) chunks.push(line.slice(index, index + 42));
    return chunks.length ? chunks : [''];
  });
  for (let index = 0; index < rawLines.length; index += 39) {
    if (index > 0) pdf.addPage();
    pdf.addImage(canvasPage(document.title, rawLines.slice(index, index + 39)), 'JPEG', 0, 0, 595.28, 841.89, undefined, 'FAST');
  }
  return pdf.output('blob');
};
