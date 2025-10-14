export interface AnalysisRequest {
  resumeText: string;
  jobDescription: string;
}

export interface AnalysisResponse {
  fitScore: number;
  fitSummary?: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  recruiterQuestions: string[];
  candidateQuestions: string[];
}

export interface AzureOpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type SkillImportance = 'core' | 'complementary' | 'bonus';

export interface SkillsMatrixRequest {
  resumeText: string;
  jobDescription: string;
}

export interface SkillsMatrixEntry {
  category: string;
  importance: SkillImportance;
  requiredKeywords: string[];
  inferredRequirements: string[];
  resumeKeywords: string[];
  experienceEvidence?: string;
  jobEmphasis: number;
  candidateAlignment: number;
  matchScore: number;
  gapReason?: string;
}

export interface SkillsMatrixResponse {
  summary?: string;
  categories: SkillsMatrixEntry[];
}
