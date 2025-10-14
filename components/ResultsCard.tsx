import React from 'react';
import type { AnalysisResponse } from '../lib/types';

interface ResultsCardProps {
  result: AnalysisResponse;
}

const ResultsCard: React.FC<ResultsCardProps> = ({ result }) => {
  const renderList = (items: string[], accentColor: string, emptyLabel: string) => {
    if (items.length === 0) {
      return <p className="mt-3 text-sm text-slate-400">{emptyLabel}</p>;
    }

    return (
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200">
        {items.map((item, index) => (
          <li key={`${accentColor}-${index}`} className="flex gap-2">
            <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${accentColor}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Fit Analysis</h2>
          {result.fitSummary && (
            <p className="mt-1 max-w-2xl text-sm text-slate-300">{result.fitSummary}</p>
          )}
        </div>
        <div className="flex items-baseline gap-2 self-start rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <span className="text-4xl font-bold text-emerald-400">{result.fitScore}</span>
          <span className="text-sm uppercase tracking-wide text-slate-400">/100</span>
        </div>
      </header>

      <div className="mt-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Strengths
            </dt>
            <dd>{renderList(result.strengths, 'bg-emerald-400', 'No strengths identified.')}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-amber-300">
              Weaknesses / Gaps
            </dt>
            <dd>{renderList(result.weaknesses, 'bg-amber-400', 'No weaknesses identified.')}</dd>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-sky-300">
              Recruiter Questions
            </dt>
            <dd>
              {renderList(
                result.recruiterQuestions,
                'bg-sky-400',
                'No recruiter questions generated.'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-violet-300">
              Candidate Questions
            </dt>
            <dd>
              {renderList(
                result.candidateQuestions,
                'bg-violet-400',
                'No candidate questions generated.'
              )}
            </dd>
          </div>
        </div>

        {result.recommendations.length > 0 && (
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Next Steps to Improve Your Fit
            </dt>
            <dd>{renderList(result.recommendations, 'bg-emerald-400', '')}</dd>
          </div>
        )}
      </div>
    </section>
  );
};

export default ResultsCard;
