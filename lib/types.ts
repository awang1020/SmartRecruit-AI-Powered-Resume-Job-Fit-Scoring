export interface AnalysisRequest {
  resumeText: string;
  jobDescription: string;
}

export interface AnalysisResponse {
  fitScore: number;
  recommendations: string[];
  recruiterQuestions: string[];
  candidateQuestions: string[];
}

export interface AzureOpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
