import React, { useEffect, useMemo, useRef, useState } from 'react';

import Loader from './Loader';
import type { SkillImportance, SkillsMatrixEntry } from '../lib/types';

type MatchStatus = 'strong' | 'needs-improvement' | 'weak';

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

const determineStatus = (score: number): MatchStatus => {
  if (score >= 80) {
    return 'strong';
  }
  if (score >= 40) {
    return 'needs-improvement';
  }
  return 'weak';
};

const formatImportance = (importance: SkillImportance): string => {
  switch (importance) {
    case 'core':
      return 'Core priority';
    case 'bonus':
      return 'Bonus / differentiator';
    default:
      return 'Complementary';
  }
};

interface TooltipDetails {
  required: string[];
  inferred: string[];
  resume: string[];
  experience?: string;
  gapReason?: string;
  status: MatchStatus;
}

const SkillsRadarMatrix: React.FC<SkillsRadarMatrixProps> = ({ resumeText, jobDescriptionText }) => {
  const [isChartReady, setChartReady] = useState(false);
  const [entries, setEntries] = useState<SkillsMatrixEntry[]>([]);
  const [summary, setSummary] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<any>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingPayload, setPendingPayload] = useState<
    | {
        resumeText: string;
        jobDescription: string;
      }
    | null
  >(null);

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

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
      requestControllerRef.current = null;
    }

    if (!resumeText.trim() || !jobDescriptionText.trim()) {
      setEntries([]);
      setSummary(undefined);
      setError(null);
      setIsLoading(false);
      setPendingPayload(null);
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setPendingPayload({
        resumeText,
        jobDescription: jobDescriptionText
      });
    }, 600);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [jobDescriptionText, resumeText]);

  useEffect(() => {
    if (!pendingPayload) {
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;

    let isActive = true;

    const fetchMatrix = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/skills-matrix', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pendingPayload),
          signal: controller.signal
        });

        const payload = await response.json().catch(() => null);

        if (!isActive || controller.signal.aborted) {
          return;
        }

        if (!response.ok || !payload) {
          const message = payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error: unknown }).error ?? 'Unable to generate skills matrix.')
            : 'Unable to generate skills matrix.';
          throw new Error(message);
        }

        const data = payload as { categories?: SkillsMatrixEntry[]; summary?: string };
        setEntries(data.categories ?? []);
        setSummary(data.summary ?? undefined);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        if (!isActive) {
          return;
        }
        setEntries([]);
        setSummary(undefined);
        const message = err instanceof Error ? err.message : 'Failed to generate skills matrix.';
        setError(message);
      } finally {
        if (!isActive) {
          return;
        }
        setIsLoading(false);
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
      }
    };

    fetchMatrix();

    return () => {
      isActive = false;
      controller.abort();
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    };
  }, [pendingPayload]);

  const decoratedEntries = useMemo(
    () =>
      entries
        .map((entry) => ({
          ...entry,
          status: determineStatus(entry.matchScore)
        }))
        .sort(
          (a, b) =>
            b.jobEmphasis - a.jobEmphasis || b.candidateAlignment - a.candidateAlignment || b.matchScore - a.matchScore
        ),
    [entries]
  );

  const labels = useMemo(() => decoratedEntries.map((entry) => entry.category), [decoratedEntries]);
  const jobEmphasis = useMemo(() => decoratedEntries.map((entry) => entry.jobEmphasis), [decoratedEntries]);
  const candidateAlignment = useMemo(
    () => decoratedEntries.map((entry) => entry.candidateAlignment),
    [decoratedEntries]
  );

  const chartTooltips = useMemo<TooltipDetails[]>(
    () =>
      decoratedEntries.map((entry) => ({
        required: entry.requiredKeywords,
        inferred: entry.inferredRequirements,
        resume: entry.resumeKeywords,
        experience: entry.experienceEvidence,
        gapReason: entry.gapReason,
        status: entry.status
      })),
    [decoratedEntries]
  );

  useEffect(() => {
    if (!isChartReady || !canvasRef.current || !window.Chart) {
      return;
    }

    if (!decoratedEntries.length) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const buildTooltipLabel = (context: any) => {
      const base = `${context.dataset.label}: ${context.formattedValue}`;
      const details = chartTooltips[context.dataIndex];
      if (!details) {
        return base;
      }

      const lines: string[] = [base];

      if (context.datasetIndex === 0) {
        if (details.required.length) {
          lines.push(`• JD: ${details.required.join(', ')}`);
        }
        if (details.inferred.length) {
          lines.push(`• Inferred: ${details.inferred.join(', ')}`);
        }
      } else {
        if (details.resume.length) {
          lines.push(`• Resume: ${details.resume.join(', ')}`);
        }
        if (details.experience) {
          lines.push(`• Evidence: ${details.experience}`);
        }
      }

      return lines.join('\n');
    };

    const buildTooltipFooter = (contexts: any[]) => {
      if (!contexts.length) {
        return '';
      }
      const { dataIndex } = contexts[0];
      const details = chartTooltips[dataIndex];
      if (!details) {
        return '';
      }
      const lines: string[] = [];
      if (details.status === 'strong') {
        lines.push('Status: ✅ Strong match');
      } else if (details.status === 'needs-improvement') {
        lines.push('Status: ⚠️ Needs improvement');
      } else {
        lines.push('Status: ❌ Missing or weak');
      }
      if (details.gapReason) {
        lines.push(`Gap: ${details.gapReason}`);
      }
      return lines.join('\n');
    };

    const chartConfig = {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Job Emphasis',
            data: jobEmphasis,
            borderColor: 'rgb(94, 234, 212)',
            backgroundColor: 'rgba(94, 234, 212, 0.25)',
            borderWidth: 2,
            pointBackgroundColor: 'rgb(94, 234, 212)',
            pointBorderColor: 'rgba(15, 118, 110, 1)',
            pointHoverRadius: 5
          },
          {
            label: 'Candidate Alignment',
            data: candidateAlignment,
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
              label: buildTooltipLabel,
              footer: buildTooltipFooter
            }
          }
        }
      }
    };

    if (!chartInstance.current) {
      chartInstance.current = new window.Chart(canvasRef.current, chartConfig);
    } else {
      chartInstance.current.data.labels = labels;
      chartInstance.current.data.datasets[0].data = jobEmphasis;
      chartInstance.current.data.datasets[1].data = candidateAlignment;
      chartInstance.current.options.plugins.tooltip.callbacks = {
        label: buildTooltipLabel,
        footer: buildTooltipFooter
      };
      chartInstance.current.update();
    }
  }, [candidateAlignment, chartTooltips, decoratedEntries.length, isChartReady, jobEmphasis, labels]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <section className="mt-8 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-100">
        <h3 className="text-lg font-semibold text-rose-50">Skills radar</h3>
        <p className="mt-2">{error}</p>
      </section>
    );
  }

  if (!decoratedEntries.length) {
    if (isLoading) {
      return (
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Skills radar</h3>
            <Loader label="Building semantic skills matrix" />
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Analyzing the job description and resume to derive contextual skill categories…
          </p>
        </section>
      );
    }

    return (
      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        <h3 className="text-lg font-semibold text-slate-100">Skills radar</h3>
        <p className="mt-2 text-slate-400">
          Provide both a resume and job description to generate the AI-powered skills comparison matrix.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">AI semantic skills matrix</h3>
          <p className="text-sm text-slate-400">
            Contextual comparison of the job&apos;s emphasis versus the candidate&apos;s demonstrated experience.
          </p>
          {summary && <p className="mt-2 text-sm text-slate-300">{summary}</p>}
        </div>
        <div className="flex flex-col items-start gap-2 text-xs sm:items-end">
          {isLoading && <Loader label="Refreshing matrix" />}
          <div className="flex flex-wrap gap-3">
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
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative h-[420px] w-full">
          <canvas ref={canvasRef} />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Category breakdown</h4>
          <ul className="space-y-3 text-sm text-slate-200">
            {decoratedEntries.map((entry) => (
              <li key={entry.category} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-slate-50">{entry.category}</p>
                      <p className="text-xs text-slate-400">Importance: {formatImportance(entry.importance)}</p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-400">
                      <p>JD keywords: {entry.requiredKeywords.length ? entry.requiredKeywords.join(', ') : '—'}</p>
                      <p>
                        Inferred needs:{' '}
                        {entry.inferredRequirements.length ? entry.inferredRequirements.join(', ') : '—'}
                      </p>
                      <p>
                        Resume evidence: {entry.resumeKeywords.length ? entry.resumeKeywords.join(', ') : '—'}
                      </p>
                      {entry.experienceEvidence && <p>Depth: {entry.experienceEvidence}</p>}
                      {entry.gapReason && entry.status !== 'strong' && <p>Gap: {entry.gapReason}</p>}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-emerald-300">Job emphasis: {entry.jobEmphasis}</p>
                    <p
                      className={
                        entry.status === 'strong'
                          ? 'text-emerald-300'
                          : entry.status === 'needs-improvement'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                      }
                    >
                      Candidate: {entry.candidateAlignment}
                    </p>
                    <p className="mt-1 text-slate-300">Match score: {entry.matchScore}</p>
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
