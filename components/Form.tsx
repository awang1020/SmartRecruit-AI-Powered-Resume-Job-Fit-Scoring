import React, { useRef } from 'react';

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

    try {
      const text = await file.text();
      onResumeChange(text);
    } catch (error) {
      console.error('Failed to read file contents', error);
      window.alert('Unable to read the selected file. Please upload a plain text resume.');
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
              accept=".txt,.md,.rtf,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            Upload text file
          </label>
        </div>
        <p className="text-xs text-slate-400">
          Paste your resume content or upload a text-based file (.txt, .md, .rtf). For rich formats, export to text first.
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
