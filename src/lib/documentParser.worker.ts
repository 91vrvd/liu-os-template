type OfficeParseMode = 'validate-pptx' | 'read-docx' | 'read-xlsx';

interface OfficeParseRequest {
  mode: OfficeParseMode;
  buffer: ArrayBuffer;
}

interface OfficeParseResponse {
  ok: boolean;
  text?: string;
  slides?: Array<{ number: number; title: string; text: string }>;
  sheets?: Array<{ name: string; rows: string[][] }>;
  error?: string;
}

const OFFICE_MAX_ENTRIES = 4000;
const OFFICE_MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const OFFICE_MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const validateArchive = async (buffer: ArrayBuffer) => {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > OFFICE_MAX_ENTRIES) throw new Error('office-too-many-entries');

  let totalSize = 0;
  entries.forEach((entry) => {
    const parts = entry.name.replace(/\\/g, '/').split('/');
    if (entry.name.startsWith('/') || parts.includes('..')) throw new Error('office-invalid-entry-path');
    const size = Number((entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0);
    if (size > OFFICE_MAX_ENTRY_BYTES) throw new Error('office-entry-too-large');
    totalSize += size;
  });
  if (totalSize > OFFICE_MAX_TOTAL_BYTES) throw new Error('office-expanded-size-limit');
};

const readDocx = async (buffer: ArrayBuffer) => {
  await validateArchive(buffer);
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default ?? mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.slice(0, 200000);
};

const decodeXmlText = (value: string) => value
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const readPptx = async (buffer: ArrayBuffer) => {
  await validateArchive(buffer);
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((left, right) => Number(left.name.match(/slide(\d+)\.xml/i)?.[1] ?? 0) - Number(right.name.match(/slide(\d+)\.xml/i)?.[1] ?? 0));
  return Promise.all(slideEntries.map(async (entry, index) => {
    const xml = await entry.async('text');
    const textRuns = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/gi))
      .map((match) => decodeXmlText(match[1]).trim())
      .filter(Boolean);
    return {
      number: index + 1,
      title: textRuns[0] ?? `Slide ${index + 1}`,
      text: textRuns.join('\n').slice(0, 40000),
    };
  }));
};

const readXlsx = async (buffer: ArrayBuffer) => {
  await validateArchive(buffer);
  const XLSXModule = await import('@e965/xlsx');
  const XLSX = XLSXModule.default ?? XLSXModule;
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true, dense: false });
  return workbook.SheetNames.map((name: string) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: '' }) as unknown[][];
    return { name, rows: rows.slice(0, 1000).map((row) => row.slice(0, 40).map((cell) => String(cell ?? ''))) };
  });
};

self.addEventListener('message', (event: MessageEvent<OfficeParseRequest>) => {
  void (async () => {
    try {
      if (event.data.mode === 'validate-pptx') {
        const slides = await readPptx(event.data.buffer);
        self.postMessage({ ok: true, slides } satisfies OfficeParseResponse);
        return;
      }
      if (event.data.mode === 'read-docx') {
        const text = await readDocx(event.data.buffer);
        self.postMessage({ ok: true, text } satisfies OfficeParseResponse);
        return;
      }
      const sheets = await readXlsx(event.data.buffer);
      self.postMessage({ ok: true, sheets } satisfies OfficeParseResponse);
    } catch (error) {
      self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'office-parse-failed' } satisfies OfficeParseResponse);
    }
  })();
});

export {};
