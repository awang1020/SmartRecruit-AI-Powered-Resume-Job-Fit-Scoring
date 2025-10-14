# SmartRecruit: AI-Powered Resume & Job Fit Scoring

SmartRecruit is a full-stack web application that compares a candidate resume against a job description using Azure OpenAI. The app computes a fit score, surfaces improvement suggestions, and proposes interview questions for both recruiters and candidates.

## Tech Stack
- **Frontend:** Next.js (React) + Tailwind CSS
- **Backend:** Next.js API Routes (TypeScript)
- **AI Provider:** Azure OpenAI GPT-4 (or compatible deployment)

## Features
- Paste or upload resume text alongside a job description
- Trigger AI analysis with a single **Analyze Fit** action
- Display a fit score (0-100), targeted improvement recommendations, and interview questions
- Loading indicators, validation, and friendly error messages

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Create a `.env.local` file in the project root. Never commit real secrets—`.env*` is already ignored by Git.

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your Azure credentials:

```env
AZURE_OPENAI_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=your-gpt4-deployment-name
```

> Optionally, add `AZURE_OPENAI_API_VERSION` if your deployment requires a specific API version.

### 3. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to use SmartRecruit.

## Project Structure
```
├── components/          # Reusable UI widgets
├── lib/                 # Prompt builders, OpenAI client helpers, shared types
├── pages/
│   ├── api/analyze.ts   # Server-side Azure OpenAI call
│   ├── _app.tsx         # Global app shell
│   └── index.tsx        # SmartRecruit interface
├── public/              # Static assets
├── styles/              # Tailwind entry point
├── README.md
└── docs/                # Architectural background (original specification)
```

## Deployment Notes
- All Azure OpenAI calls are performed server-side within the API route. The browser never receives or stores credentials.
- The prompt enforces a structured JSON schema to ensure predictable parsing of AI responses.
- Tailwind CSS is configured via PostCSS and purges unused styles in production builds.

## License
MIT
