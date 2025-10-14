import type { AnalysisRequest, AnalysisResponse, AzureOpenAIChatMessage } from './types';

const OUTPUT_SCHEMA = `{
  "fit_score": number (0-100),
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
        'You are an expert talent intelligence assistant. Evaluate how well a candidate resume aligns to a job description. Respond ONLY with valid JSON that matches the provided schema.'
    },
    {
      role: 'user',
      content: `Analyze the following candidate information and job description. Return a JSON object that follows this schema:\n${OUTPUT_SCHEMA}\n\nJob Description:\n"""\n${trimmedJob}\n"""\n\nCandidate Resume:\n"""\n${trimmedResume}\n"""`
    }
  ];
}

export function parseModelResponse(content: string): AnalysisResponse {
  const jsonPayload = extractJson(content);
  const data = JSON.parse(jsonPayload);

  return {
    fitScore: clampNumber(data.fit_score, 0, 100),
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

function clampNumber(value: unknown, min: number, max: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return min;
  }
  return Math.min(Math.max(Math.round(numericValue), min), max);
}
