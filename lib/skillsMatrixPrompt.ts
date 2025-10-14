import type {
  AzureOpenAIChatMessage,
  SkillsMatrixEntry,
  SkillsMatrixRequest,
  SkillsMatrixResponse,
  SkillImportance
} from './types';

const OUTPUT_SCHEMA = `{
  "summary": string | null,
  "categories": [
    {
      "category": string,
      "importance": "core" | "complementary" | "bonus",
      "job_emphasis": number (0-100),
      "candidate_alignment": number (0-100),
      "match_score": number (0-100),
      "required_keywords": string[] (3-8 items, job description evidence),
      "inferred_requirements": string[] (0-6 items, contextual inferences),
      "resume_keywords": string[] (0-8 items, resume evidence),
      "experience_evidence": string | null,
      "gap_reason": string | null
    }
  ]
}`;

const IMPORTANCE_ALIASES: Record<string, SkillImportance> = {
  core: 'core',
  critical: 'core',
  primary: 'core',
  essential: 'core',
  musthave: 'core',
  must_have: 'core',
  complementary: 'complementary',
  related: 'complementary',
  supporting: 'complementary',
  secondary: 'complementary',
  bonus: 'bonus',
  optional: 'bonus',
  nice: 'bonus',
  'nice-to-have': 'bonus',
  nicetohave: 'bonus'
};

export function buildSkillsMatrixPrompt({
  resumeText,
  jobDescription
}: SkillsMatrixRequest): AzureOpenAIChatMessage[] {
  const trimmedResume = resumeText.trim();
  const trimmedJob = jobDescription.trim();

  return [
    {
      role: 'system',
      content:
        'You are an expert talent intelligence assistant who performs semantic skill mapping between job descriptions and candidate resumes. Output must be valid JSON matching the requested schema. Make precise inferences grounded in the provided texts.'
    },
    {
      role: 'user',
      content: `Create a semantic skills comparison matrix using the following schema:\n${OUTPUT_SCHEMA}\n\nExpectations:\n- Identify distinct categories that cover core technical competencies, inferred or adjacent tooling, role expectations & soft skills, and business or industry domain knowledge. You may add other categories if meaningful.\n- Derive "required_keywords" from explicit job description language.\n- Populate "inferred_requirements" with contextual needs implied by the role (e.g., mention of dashboards implies BI tooling).\n- List "resume_keywords" using synonyms or equivalent skills from the candidate resume, even if phrasing differs.\n- Summarize key evidence of depth in "experience_evidence" (e.g., led a team, architected solution).\n- For "importance", classify as core (mission critical), complementary (important but not central), or bonus (nice-to-have).\n- Weight scores by importance:\n  • job_emphasis should reflect how heavily the job prioritizes the skill (core ~85-100, complementary ~55-80, bonus ~25-50).\n  • candidate_alignment should reflect demonstrated proficiency from the resume, considering depth indicators.\n  • match_score should synthesize alignment vs. requirement, emphasizing gaps for high-importance categories.\n- Provide "gap_reason" when the match_score is below 80, clarifying missing evidence or weaker depth.\n- Keep arrays concise, avoiding generic or irrelevant buzzwords.\n- Always produce at least four categories if information is available.\n\nJob Description:\n"""\n${trimmedJob}\n"""\n\nCandidate Resume:\n"""\n${trimmedResume}\n"""`
    }
  ];
}

export function parseSkillsMatrixResponse(content: string): SkillsMatrixResponse {
  const jsonPayload = extractJson(content);
  const data = JSON.parse(jsonPayload) as {
    summary?: unknown;
    categories?: unknown;
  };

  const categories = Array.isArray(data.categories) ? data.categories : [];

  const parsedCategories: SkillsMatrixEntry[] = categories
    .map((raw) => normalizeCategory(raw))
    .filter((category): category is SkillsMatrixEntry => category !== null);

  const summary = normalizeString(data.summary);

  return {
    summary: summary ?? undefined,
    categories: parsedCategories
  };
}

function normalizeCategory(raw: unknown): SkillsMatrixEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const entry = raw as Record<string, unknown>;

  const category = normalizeString(entry.category) ?? 'Uncategorized';
  const importance = normalizeImportance(entry.importance);
  const requiredKeywords = normalizeStringArray(entry.required_keywords ?? entry.requiredKeywords);
  const inferredRequirements = normalizeStringArray(entry.inferred_requirements ?? entry.inferredRequirements);
  const resumeKeywords = normalizeStringArray(entry.resume_keywords ?? entry.resumeKeywords);
  const experienceEvidence = normalizeString(entry.experience_evidence ?? entry.experienceEvidence) ?? undefined;
  const gapReason = normalizeString(entry.gap_reason ?? entry.gapReason) ?? undefined;
  const jobEmphasis = clampScore(entry.job_emphasis ?? entry.jobEmphasis);
  const candidateAlignment = clampScore(entry.candidate_alignment ?? entry.candidateAlignment);
  const matchScore = clampScore(entry.match_score ?? entry.matchScore);

  if (!requiredKeywords.length && !resumeKeywords.length && !inferredRequirements.length) {
    return null;
  }

  return {
    category,
    importance,
    requiredKeywords,
    inferredRequirements,
    resumeKeywords,
    experienceEvidence,
    jobEmphasis,
    candidateAlignment,
    matchScore,
    gapReason
  };
}

function normalizeImportance(value: unknown): SkillImportance {
  if (typeof value === 'string') {
    const key = value.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    if (IMPORTANCE_ALIASES[key]) {
      return IMPORTANCE_ALIASES[key];
    }
  }
  return 'complementary';
}

function clampScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.min(100, Math.max(0, Math.round(numeric)));
  }
  return 0;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  const strings: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeString(item);
      if (normalized) {
        strings.push(normalized);
      }
    }
  } else if (typeof value === 'string') {
    const parts = value
      .split(/\n|\r|,/) // handle newline or comma separated lists
      .map((part) => normalizeString(part))
      .filter((part): part is string => Boolean(part));
    strings.push(...parts);
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of strings) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

function extractJson(raw: string): string {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Model response did not contain valid JSON.');
  }
  return jsonMatch[0];
}
