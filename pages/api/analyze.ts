import type { NextApiRequest, NextApiResponse } from 'next';
import { buildAnalysisPrompt, parseModelResponse } from '../../lib/prompt';
import { getChatCompletion } from '../../lib/openai';
import type { AnalysisRequest, AnalysisResponse } from '../../lib/types';

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { resumeText, jobDescription } = req.body as AnalysisRequest;

  if (!resumeText?.trim() || !jobDescription?.trim()) {
    return res.status(400).json({ error: 'Resume and job description are required.' });
  }

  try {
    const messages = buildAnalysisPrompt({ resumeText, jobDescription });
    const completion = await getChatCompletion(messages);
    const parsed = parseModelResponse(completion);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Failed to analyze resume fit', error);
    const message =
      error instanceof Error ? error.message : 'Unexpected error while analyzing the resume fit.';
    return res.status(500).json({ error: message });
  }
}
