import type { AnalysisRequest, AnalysisResponse, AzureOpenAIChatMessage } from './types';

const OUTPUT_SCHEMA = `{
  "fit_score": number (0-100),
  "fit_summary": string | null,
  "strengths": string[] (minimum 3 items),
  "weaknesses": string[] (minimum 3 items),
  "recommendations": string[] (minimum 3 items),
  "recruiter_questions": string[] (minimum 3 items),
  "candidate_questions": string[] (minimum 3 items)
}`;

export function buildAnalysisPrompt({ resumeText, jobDescription }: AnalysisRequest): AzureOpenAIChatMessage[] {
  const trimmedResume = resumeText.trim();
  const trimmedJob = jobDescription.trim();

  return [
    {
      role: 'system',
      content:
        'You are an expert talent intelligence assistant. Evaluate how well a candidate resume aligns to a job description. Respond ONLY with valid JSON that matches the provided schema. When comparing the resume and job description, highlight strengths where the candidate meets or exceeds requirements and weaknesses where evidence is missing or insufficient.'
    },
    {
      role: 'user',
      content: `Analyze the following candidate information and job description. Return a JSON object that follows this schema:\n${OUTPUT_SCHEMA}\n\nGuidance:\n- Strengths should be concise bullet statements showing clear alignment or superior experience.\n- Weaknesses should call out missing skills, limited experience, or unclear evidence compared to the job requirements.\n- Recommendations must be framed as specific next steps the candidate can take to improve fit.\n- Fit summary should be a single sentence synthesizing the overall alignment; if you cannot provide one, return null.\n\nJob Description:\n"""\n${trimmedJob}\n"""\n\nCandidate Resume:\n"""\n${trimmedResume}\n"""`
    }
  ];
}

export function parseModelResponse(content: string): AnalysisResponse {
  const jsonPayload = extractJson(content);
  const data = JSON.parse(jsonPayload);

  return {
    fitScore: clampNumber(data.fit_score, 0, 100),
    fitSummary: normalizeString(data.fit_summary),
    strengths: normalizeStringArray(data.strengths),
    weaknesses: normalizeStringArray(data.weaknesses),
    recommendations: normalizeStringArray(data.recommendations),
    recruiterQuestions: normalizeStringArray(data.recruiter_questions),
    candidateQuestions: normalizeStringArray(data.candidate_questions)
  };
}

function extractJson(raw: string): string {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Model response did not contain valid JSON.');
  }
  return jsonMatch[0];
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value.split(/\n|\r/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function clampNumber(value: unknown, min: number, max: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return min;
  }
  return Math.min(Math.max(Math.round(numericValue), min), max);
}
