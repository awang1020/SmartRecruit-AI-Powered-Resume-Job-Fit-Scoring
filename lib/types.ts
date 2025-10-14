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
