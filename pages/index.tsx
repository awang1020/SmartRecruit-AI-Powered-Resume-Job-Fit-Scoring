import { useState } from 'react';
import AnalyzerForm from '../components/Form';
import Loader from '../components/Loader';
import ResultsCard from '../components/ResultsCard';
import type { AnalysisResponse } from '../lib/types';

export default function Home() {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resumeText, jobDescription })
      });

      if (!response.ok) {
        const message = await response.json();
        throw new Error(message.error ?? 'Unable to analyze resume fit.');
      }

      const data = (await response.json()) as AnalysisResponse;
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze resume fit.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResumeText('');
    setJobDescription('');
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <header className="text-center">
          <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            SmartRecruit
          </span>
          <h1 className="mt-4 text-3xl font-bold text-slate-50 sm:text-5xl">
            AI-powered resume & job fit scoring
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
            Compare candidate resumes against job descriptions with Azure OpenAI. Generate fit scores, actionable improvement
            tips, and interview questions for both recruiters and candidates.
          </p>
        </header>

        <section className="mt-10">
          <AnalyzerForm
            resumeText={resumeText}
            jobDescription={jobDescription}
            onResumeChange={setResumeText}
            onJobDescriptionChange={setJobDescription}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onReset={handleReset}
          />

          <div className="mt-6 min-h-[24px]">
            {isLoading && <Loader label="Scoring candidate" />}
            {error && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error}
              </p>
            )}
          </div>

          {result && <ResultsCard result={result} />}
        </section>

        <footer className="mt-16 text-center text-xs text-slate-500">
          Built with Next.js, Tailwind CSS, and Azure OpenAI. Ensure your Azure credentials are set in <code>.env.local</code>
          before running <code>npm run dev</code>.
        </footer>
      </div>
    </main>
  );
}
