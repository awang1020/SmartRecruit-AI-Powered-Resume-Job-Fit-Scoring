import React, { useRef } from 'react';

const SUPPORTED_EXTENSIONS = new Set(['txt', 'md', 'rtf', 'pdf', 'docx']);

declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (options: unknown) => { promise: Promise<any> };
      GlobalWorkerOptions: { workerSrc: string };
    };
    __pdfjsLoadingPromise?: Promise<any>;
    mammoth?: {
      extractRawText: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
    __mammothLoadingPromise?: Promise<any>;
  }
}

const CDN_BASE_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
const MAMMOTH_BROWSER_SRC = 'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js';

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Scripts can only be loaded in the browser.'));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.status === 'loaded') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.status = 'loading';
    script.onload = () => {
      script.dataset.status = 'loaded';
      resolve();
    };
    script.onerror = () => {
      script.dataset.status = 'error';
      reject(new Error(`Failed to load script ${src}`));
    };
    document.head.appendChild(script);
  });

const loadPdfJs = async () => {
  if (typeof window === 'undefined') {
    throw new Error('PDF parsing is only supported in the browser.');
  }

  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  if (!window.__pdfjsLoadingPromise) {
    window.__pdfjsLoadingPromise = (async () => {
      await loadScript(`${CDN_BASE_PDF}/pdf.min.js`);
      if (!window.pdfjsLib) {
        throw new Error('Failed to initialize the PDF.js library.');
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN_BASE_PDF}/pdf.worker.min.js`;
      return window.pdfjsLib;
    })();
  }

  return window.__pdfjsLoadingPromise;
};

const loadMammoth = async () => {
  if (typeof window === 'undefined') {
    throw new Error('DOCX parsing is only supported in the browser.');
  }

  if (window.mammoth) {
    return window.mammoth;
  }

  if (!window.__mammothLoadingPromise) {
    window.__mammothLoadingPromise = (async () => {
      await loadScript(MAMMOTH_BROWSER_SRC);
      if (!window.mammoth) {
        throw new Error('Failed to initialize the Mammoth library.');
      }
      return window.mammoth;
    })();
  }

  return window.__mammothLoadingPromise;
};

const stripRtf = (value: string) =>
  value
    .replace(/\{\\(?:\*?[^}]|[^{}])*}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\\'[0-9a-fA-F]{2}/g, (match) =>
      String.fromCharCode(parseInt(match.slice(2), 16))
    )
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanExtractedText = (value: string) => {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/^[\t ]*\d+[\t ]*$/gm, '')
    .replace(/^page\s+\d+(\s+of\s+\d+)?$/gim, '')
    .replace(/^(title|author|subject|keywords|creator|producer|creationdate|moddate):.*$/gim, '')
    .replace(/[ \t]+\n/g, '\n');

  const lines = normalized
    .split('\n')
    .map((line) =>
      line
        .replace(/[^\S\n]+/g, ' ')
        .replace(/\s?[-–—]\s?/g, (match) => (match.trim() === '-' ? ' - ' : ' '))
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((line, index, array) => line.length > 0 || (index > 0 && array[index - 1].length > 0));

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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

  const extractPdf = async (file: File) => {
    const pdfjsLib = await loadPdfJs();
    const typedArray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

    try {
      const pageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .filter((segment: string) => segment.trim().length > 0)
          .join(' ');
        if (pageText) {
          pageTexts.push(pageText);
        }
      }
      return pageTexts.join('\n');
    } finally {
      if (typeof pdf.cleanup === 'function') {
        await pdf.cleanup();
      }
      if (typeof pdf.destroy === 'function') {
        await pdf.destroy();
      }
    }
  };

  const extractDocx = async (file: File) => {
    const mammoth = await loadMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value ?? '';
  };

  const readPlainText = async (file: File, extension: string) => {
    let rawText = await file.text();
    if (extension === 'rtf') {
      rawText = stripRtf(rawText);
    }
    return rawText;
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      window.alert('Unsupported file type. Please upload a TXT, MD, RTF, PDF, or DOCX file.');
      resetFileInput();
      return;
    }

    try {
      let extracted = '';

      if (extension === 'pdf') {
        extracted = await extractPdf(file);
      } else if (extension === 'docx') {
        extracted = await extractDocx(file);
      } else {
        extracted = await readPlainText(file, extension);
      }

      const cleaned = cleanExtractedText(extracted);

      if (!cleaned) {
        throw new Error('Unable to extract readable text from the selected file.');
      }

      onResumeChange(cleaned);
      resetFileInput();
    } catch (error) {
      console.error('Failed to process file contents', error);
      window.alert(
        error instanceof Error
          ? error.message
          : 'Unable to read the selected file. Please try a different document.'
      );
      resetFileInput();
    }
  };

  const handleClear = () => {
    onReset();
    resetFileInput();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40"
    >
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-50">Candidate Resume</h2>
          <div className="flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-slate-700 px-3 py-1 font-medium hover:border-emerald-400 hover:text-emerald-200">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.rtf,.pdf,.docx"
                className="hidden"
                onChange={handleFileUpload}
              />
              Upload file
            </label>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Paste your resume content or upload a supported file (.txt, .md, .rtf, .pdf, .docx). Rich formats are converted to
          clean, readable text automatically for quick analysis.
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
