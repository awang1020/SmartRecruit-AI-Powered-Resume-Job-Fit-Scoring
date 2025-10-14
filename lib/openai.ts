import type { AzureOpenAIChatMessage } from './types';

interface AzureChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function getChatCompletion(messages: AzureOpenAIChatMessage[]): Promise<string> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-15-preview';

  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI credentials are not fully configured.');
  }

  const url = new URL(`/openai/deployments/${deployment}/chat/completions`, endpoint);
  url.searchParams.set('api-version', apiVersion);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      messages,
      temperature: 1,
      max_completion_tokens: 5000,
      n: 1
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Azure OpenAI request failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = (await response.json()) as AzureChatCompletionsResponse;
  const [choice] = data.choices ?? [];
  const content = choice?.message?.content;

  if (!content) {
    throw new Error('Azure OpenAI returned an empty response.');
  }

  return content;
}
