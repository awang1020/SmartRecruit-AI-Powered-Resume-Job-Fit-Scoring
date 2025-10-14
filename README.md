# SmartRecruit: AI-Powered Resume & Job Fit Scoring

SmartRecruit is a portfolio-ready blueprint for building an AI-powered assistant that compares a candidate CV against a job description using Azure OpenAI. The project deliverables include a system architecture, feature roadmap, API design, and prompt engineering guidance that you can extend into a full-stack web application.

## Highlights
- **Target stack:** FastAPI backend with a React single-page application frontend.
- **LLM provider:** Azure OpenAI `gpt-4o-mini` for reasoning, alongside Azure Text Embedding for semantic similarity.
- **Core capabilities:** Resume/job comparison, scoring, insights, and interview preparation workflows.

## Repository Structure
- `docs/architecture.md` – High-level solution architecture, deployment view, and data flow.
- `docs/feature-roadmap.md` – Functional specification and phased delivery plan.
- `docs/api-and-prompts.md` – Example FastAPI routes, Azure OpenAI requests, prompt templates, and output schema.

## Getting Started
1. Review the documents under `docs/` to understand the architecture and implementation approach.
2. Provision Azure OpenAI resources (model deployment name for `gpt-4o-mini` and embeddings).
3. Scaffold the FastAPI backend and React frontend following the specifications in `docs/architecture.md`.
4. Implement the scoring pipeline, prompt orchestration, and UI components.
5. Deploy to your preferred cloud (Azure App Service, Azure Static Web Apps, or container-based options) and showcase on GitHub.

## Next Steps
- Extend the provided code snippets into working services.
- Add automated tests for prompt formatting, response parsing, and scoring consistency.
- Integrate application monitoring (Azure Application Insights) to track usage and model performance.

## License
MIT
