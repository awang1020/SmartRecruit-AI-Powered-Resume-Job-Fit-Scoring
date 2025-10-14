import React from 'react';
import type { AnalysisResponse } from '../lib/types';

interface ResultsCardProps {
  result: AnalysisResponse;
}

const ResultsCard: React.FC<ResultsCardProps> = ({ result }) => {
  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-50">Fit Analysis</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-emerald-400">{result.fitScore}</span>
          <span className="text-sm uppercase tracking-wide text-slate-400">/100</span>
        </div>
      </header>

      <dl className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Recommendations
          </dt>
          <dd>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200">
              {result.recommendations.map((item, index) => (
                <li key={`rec-${index}`} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>

        <div className="space-y-6">
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-sky-300">
              Recruiter Questions
            </dt>
            <dd>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200">
                {result.recruiterQuestions.map((item, index) => (
                  <li key={`recq-${index}`} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>

          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-violet-300">
              Candidate Questions
            </dt>
            <dd>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200">
                {result.candidateQuestions.map((item, index) => (
                  <li key={`candq-${index}`} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </div>
      </dl>
    </section>
  );
};

export default ResultsCard;
