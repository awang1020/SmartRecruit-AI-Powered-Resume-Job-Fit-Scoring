import type { NextApiRequest, NextApiResponse } from 'next';
import { getChatCompletion } from '../../lib/openai';
import { buildSkillsMatrixPrompt, parseSkillsMatrixResponse } from '../../lib/skillsMatrixPrompt';
import type { SkillsMatrixRequest, SkillsMatrixResponse } from '../../lib/types';

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SkillsMatrixResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { resumeText, jobDescription } = req.body as SkillsMatrixRequest;

  if (!resumeText?.trim() || !jobDescription?.trim()) {
    return res.status(400).json({ error: 'Resume and job description are required.' });
  }

  try {
    const messages = buildSkillsMatrixPrompt({ resumeText, jobDescription });
    const completion = await getChatCompletion(messages);
    const parsed = parseSkillsMatrixResponse(completion);

    if (!parsed.categories.length) {
      return res.status(422).json({
        error: 'Unable to derive a skills matrix from the provided documents.'
      });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Failed to generate skills matrix', error);
    const message =
      error instanceof Error ? error.message : 'Unexpected error while generating the skills matrix.';
    return res.status(500).json({ error: message });
  }
}
