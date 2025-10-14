import React, { useRef } from 'react';

const SUPPORTED_EXTENSIONS = new Set(['txt', 'md', 'rtf', 'pdf', 'docx']);

const sanitizeExtractedText = (value: string) =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const decodePdfToken = (token: string) =>
  token
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\f/g, '\f')
    .replace(/\\\\/g, '\\');

const extractTextFromPdf = (buffer: ArrayBuffer) => {
  const raw = new TextDecoder('latin1').decode(buffer);
  const segments: string[] = [];

  const simpleRegex = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let simpleMatch: RegExpExecArray | null;
  while ((simpleMatch = simpleRegex.exec(raw)) !== null) {
    const content = simpleMatch[0].replace(/Tj$/, '').trim();
    segments.push(decodePdfToken(content.slice(1, -1)));
  }

  const arrayRegex = /\[(.*?)\]\s*TJ/g;
  let arrayMatch: RegExpExecArray | null;
  while ((arrayMatch = arrayRegex.exec(raw)) !== null) {
    const inner = arrayMatch[1];
    const innerSegments: string[] = [];
    const tokenRegex = /\((?:\\.|[^\\)])*\)/g;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = tokenRegex.exec(inner)) !== null) {
      innerSegments.push(decodePdfToken(tokenMatch[0].slice(1, -1)));
    }
    if (innerSegments.length) {
      segments.push(innerSegments.join(''));
    }
  }

  if (segments.length === 0) {
    return raw.replace(/\r\n/g, '\n');
  }

  return segments.join('\n');
};

const collectStreamChunks = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
};

const decompressDeflateRaw = async (data: Uint8Array) => {
  const DecompressionStreamCtor = (window as typeof window & {
    DecompressionStream?: new (format: string) => {
      readable: ReadableStream<Uint8Array>;
      writable: WritableStream<Uint8Array>;
    };
  }).DecompressionStream;

  if (typeof DecompressionStreamCtor !== 'function') {
    throw new Error('DOCX extraction is not supported in this browser.');
  }

  const stream = new DecompressionStreamCtor('deflate-raw');
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return collectStreamChunks(stream.readable);
};

const extractWordDocumentXml = async (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const findEndOfCentralDirectory = () => {
    for (let index = bytes.length - 22; index >= 0; index -= 1) {
      if (view.getUint32(index, true) === 0x06054b50) {
        return index;
      }
    }
    throw new Error('Invalid DOCX archive structure.');
  };

  const eocdOffset = findEndOfCentralDirectory();
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);

  let offset = centralDirectoryOffset;
  let target:
    | {
        localHeaderOffset: number;
        compressedSize: number;
        compression: number;
      }
    | null = null;

  const decoder = new TextDecoder();

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Unable to read DOCX directory entries.');
    }

    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = decoder.decode(bytes.subarray(fileNameStart, fileNameEnd));

    if (fileName === 'word/document.xml') {
      target = {
        localHeaderOffset: view.getUint32(offset + 42, true),
        compressedSize,
        compression,
      };
      break;
    }

    offset = fileNameEnd + extraLength + commentLength;
  }

  if (!target) {
    throw new Error('Unable to locate DOCX main document.');
  }

  const { localHeaderOffset, compressedSize, compression } = target;

  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
    throw new Error('Invalid DOCX file header.');
  }

  const nameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  const compressedData = bytes.subarray(dataStart, dataEnd);

  if (compression === 0) {
    return decoder.decode(compressedData);
  }

  if (compression !== 8) {
    throw new Error('Unsupported DOCX compression method.');
  }

  const decompressed = await decompressDeflateRaw(compressedData);
  return decoder.decode(decompressed);
};

const collectParagraphText = (paragraph: Element): string => {
  const parts: string[] = [];

  const processNode = (node: ChildNode): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? '';
      if (value) {
        parts.push(value);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    if (element.tagName === 'w:tab') {
      parts.push('\t');
      return;
    }

    if (element.tagName === 'w:br') {
      parts.push('\n');
      return;
    }

    if (element.tagName === 'w:t') {
      parts.push(element.textContent ?? '');
      return;
    }

    Array.from(element.childNodes).forEach(processNode);
  };

  Array.from(paragraph.childNodes).forEach(processNode);
  return parts.join('').replace(/\n{2,}/g, '\n').trimEnd();
};

const extractTextFromDocx = async (buffer: ArrayBuffer) => {
  const xmlContent = await extractWordDocumentXml(buffer);
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlContent, 'application/xml');

  if (xml.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Unable to parse DOCX contents.');
  }

  const paragraphs = Array.from(xml.getElementsByTagName('w:p'));
  const lines = paragraphs
    .map(collectParagraphText)
    .filter((line) => line.trim().length > 0);

  return lines.join('\n');
};

interface AnalyzerFormProps {
  resumeText: string;
  jobDescription: string;
  onResumeChange: (value: string) => void;
  onJobDescriptionChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  onReset: () => void;
}

const AnalyzerForm: React.FC<AnalyzerFormProps> = ({
  resumeText,
  jobDescription,
  onResumeChange,
  onJobDescriptionChange,
  onSubmit,
  isLoading,
  onReset
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      window.alert('Unsupported file type. Please upload a TXT, MD, RTF, PDF, or DOCX file.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      if (extension === 'pdf') {
        const buffer = await file.arrayBuffer();
        const extracted = extractTextFromPdf(buffer);
        if (!extracted.trim()) {
          throw new Error('Unable to extract readable text from the PDF file.');
        }
        onResumeChange(sanitizeExtractedText(extracted));
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      if (extension === 'docx') {
        const buffer = await file.arrayBuffer();
        const extracted = await extractTextFromDocx(buffer);
        if (!extracted.trim()) {
          throw new Error('Unable to extract readable text from the DOCX file.');
        }
        onResumeChange(sanitizeExtractedText(extracted));
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      const text = await file.text();
      onResumeChange(sanitizeExtractedText(text));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to process file contents', error);
      window.alert(
        error instanceof Error
          ? error.message
          : 'Unable to read the selected file. Please try a different document.'
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = () => {
    onReset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40"
    >
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-50">Candidate Resume</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-emerald-400 hover:text-emerald-200">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.rtf,.pdf,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            Upload text file
          </label>
        </div>
        <p className="text-xs text-slate-400">
          Paste your resume content or upload a supported file (.txt, .md, .rtf, .pdf, .docx). Rich formats are converted to
          readable text automatically.
        </p>
        <textarea
          required
          value={resumeText}
          onChange={(event) => onResumeChange(event.target.value)}
          placeholder="Paste the candidate resume here..."
          className="h-64 w-full rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-50">Job Description</h2>
        <textarea
          required
          value={jobDescription}
          onChange={(event) => onJobDescriptionChange(event.target.value)}
          placeholder="Paste the job description here..."
          className="h-48 w-full rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={isLoading || !resumeText.trim() || !jobDescription.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/40 disabled:text-emerald-200/70"
        >
          {isLoading ? 'Analyzing…' : 'Analyze Fit'}
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="text-sm font-medium text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
        >
          Clear inputs
        </button>
      </div>
    </form>
  );
};

export default AnalyzerForm;
