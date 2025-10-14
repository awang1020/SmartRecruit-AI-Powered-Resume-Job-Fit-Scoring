import React, { useEffect, useMemo, useRef, useState } from 'react';

import { analyzeSkills, SkillAnalysisEntry } from '../lib/skillCategorizer';

interface SkillsRadarMatrixProps {
  resumeText: string;
  jobDescriptionText: string;
}

declare global {
  interface Window {
    Chart?: any;
  }
}

const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.5/dist/chart.umd.min.js';

const SkillsRadarMatrix: React.FC<SkillsRadarMatrixProps> = ({ resumeText, jobDescriptionText }) => {
  const [isChartReady, setChartReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.Chart) {
      setChartReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = CHART_JS_CDN;
    script.async = true;
    script.onload = () => setChartReady(true);
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  const analysisEntries = useMemo<SkillAnalysisEntry[]>(() => {
    return analyzeSkills(resumeText, jobDescriptionText);
  }, [jobDescriptionText, resumeText]);

  const labels = useMemo(() => analysisEntries.map((entry) => entry.category), [analysisEntries]);

  const requiredScores = useMemo(
    () => analysisEntries.map((entry) => entry.requiredScore),
    [analysisEntries]
  );

  const candidateScores = useMemo(
    () => analysisEntries.map((entry) => entry.candidateScore),
    [analysisEntries]
  );

  const chartTooltips = useMemo(
    () =>
      analysisEntries.map((entry) => ({
        required: entry.requiredKeywords,
        candidate: entry.candidateKeywords,
        status: entry.status
      })),
    [analysisEntries]
  );

  useEffect(() => {
    if (!isChartReady || !canvasRef.current || !window.Chart) {
      return;
    }

    if (!analysisEntries.length) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    if (!chartInstance.current) {
      chartInstance.current = new window.Chart(canvasRef.current, {
        type: 'radar',
        data: {
          labels,
          datasets: [
            {
              label: 'Job Requirement',
              data: requiredScores,
              borderColor: 'rgb(94, 234, 212)',
              backgroundColor: 'rgba(94, 234, 212, 0.25)',
              borderWidth: 2,
              pointBackgroundColor: 'rgb(94, 234, 212)',
              pointBorderColor: 'rgba(15, 118, 110, 1)',
              pointHoverRadius: 5
            },
            {
              label: 'Candidate',
              data: candidateScores,
              borderColor: 'rgb(129, 140, 248)',
              backgroundColor: 'rgba(129, 140, 248, 0.25)',
              borderWidth: 2,
              pointBackgroundColor: 'rgb(129, 140, 248)',
              pointBorderColor: 'rgba(67, 56, 202, 1)',
              pointHoverRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              suggestedMin: 0,
              suggestedMax: 100,
              angleLines: {
                color: 'rgba(148, 163, 184, 0.2)'
              },
              grid: {
                color: 'rgba(148, 163, 184, 0.2)'
              },
              ticks: {
                backdropColor: 'rgba(15, 23, 42, 0.65)',
                color: 'rgb(226, 232, 240)',
                stepSize: 20
              },
              pointLabels: {
                color: 'rgb(226, 232, 240)',
                font: {
                  size: 12
                }
              }
            }
          },
          plugins: {
            legend: {
              labels: {
                color: 'rgb(226, 232, 240)'
              }
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const label = `${context.dataset.label}: ${context.formattedValue}`;
                  const details = chartTooltips[context.dataIndex];
                  if (!details) {
                    return label;
                  }
                  const keywords =
                    context.datasetIndex === 0 ? details.required : details.candidate;
                  if (!keywords.length) {
                    return label;
                  }
                  return `${label}\n• Keywords: ${keywords.join(', ')}`;
                },
                footer(contexts) {
                  if (!contexts.length) {
                    return '';
                  }
                  const { dataIndex } = contexts[0];
                  const details = chartTooltips[dataIndex];
                  if (!details) {
                    return '';
                  }
                  if (details.status === 'strong') {
                    return 'Status: ✅ Strong match';
                  }
                  if (details.status === 'needs-improvement') {
                    return 'Status: ⚠️ Needs improvement';
                  }
                  return 'Status: ❌ Missing or weak';
                }
              }
            }
          }
        }
      });
    } else {
      chartInstance.current.data.labels = labels;
      chartInstance.current.data.datasets[0].data = requiredScores;
      chartInstance.current.data.datasets[1].data = candidateScores;
      chartInstance.current.options.plugins.tooltip.callbacks = {
        label(context) {
          const label = `${context.dataset.label}: ${context.formattedValue}`;
          const details = chartTooltips[context.dataIndex];
          if (!details) {
            return label;
          }
          const keywords = context.datasetIndex === 0 ? details.required : details.candidate;
          if (!keywords.length) {
            return label;
          }
          return `${label}\n• Keywords: ${keywords.join(', ')}`;
        },
        footer(contexts) {
          if (!contexts.length) {
            return '';
          }
          const { dataIndex } = contexts[0];
          const details = chartTooltips[dataIndex];
          if (!details) {
            return '';
          }
          if (details.status === 'strong') {
            return 'Status: ✅ Strong match';
          }
          if (details.status === 'needs-improvement') {
            return 'Status: ⚠️ Needs improvement';
          }
          return 'Status: ❌ Missing or weak';
        }
      };
      chartInstance.current.update();
    }
  }, [analysisEntries, candidateScores, chartTooltips, isChartReady, labels, requiredScores]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);

  if (!analysisEntries.length) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        <h3 className="text-lg font-semibold text-slate-100">Skills radar</h3>
        <p className="mt-2 text-slate-400">
          Provide both a resume and job description to generate the skills comparison matrix.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Skills radar matrix</h3>
          <p className="text-sm text-slate-400">
            Comparing the emphasis of the job posting against the candidate&apos;s demonstrated skills.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            <span className="text-lg">✅</span> Strong (≥ 80)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
            <span className="text-lg">⚠️</span> Needs improvement (40-79)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-rose-200">
            <span className="text-lg">❌</span> Missing / weak (&lt; 40)
          </span>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative h-[420px] w-full">
          <canvas ref={canvasRef} />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Category breakdown
          </h4>
          <ul className="space-y-3 text-sm text-slate-200">
            {analysisEntries.map((entry) => (
              <li key={entry.category} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-50">{entry.category}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      JD keywords: {entry.requiredKeywords.length ? entry.requiredKeywords.join(', ') : '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Resume keywords: {entry.candidateKeywords.length ? entry.candidateKeywords.join(', ') : '—'}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-emerald-300">Required: {entry.requiredScore}</p>
                    <p
                      className={
                        entry.status === 'strong'
                          ? 'text-emerald-300'
                          : entry.status === 'needs-improvement'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                      }
                    >
                      Candidate: {entry.candidateScore}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </section>
  );
};

export default SkillsRadarMatrix;
