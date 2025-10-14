# Architecture Overview

## Solution Objectives
- Compare a job description with a candidate CV using Azure OpenAI `gpt-4o-mini`.
- Deliver a comprehensive fit score (0–100), recommendations, and interview questions for recruiters and candidates.
- Provide an extendable portfolio project that demonstrates thoughtful design, clean API boundaries, and scalable deployment options.

## High-Level System Design
```
+----------------------+        +-----------------------------+
| React Frontend (SPA) |<------>|  FastAPI Backend (REST API) |
+----------+-----------+   HTTPS +---------------+-------------+
           |                                |
           |                                | Azure SDK (REST)
           |                                v
           |                  +-----------------------------+
           |                  | Azure OpenAI (gpt-4o-mini) |
           |                  +-----------------------------+
           |                                ^
           |                                |
           |                  +-----------------------------+
           |                  | Azure Cognitive Storage     |
           |                  | (Blob Storage + Tables)     |
           |                  +-----------------------------+
```

### Frontend (React)
- Upload or paste CV/Resume and Job Description text (support `.pdf` via backend parsing).
- Displays fit score, recommendations, and interview questions.
- Offers download/export (JSON, PDF) of the AI evaluation.
- Provides dashboard history pulled from backend storage.

### Backend (FastAPI)
- REST endpoints for:
  - `/analyze` – orchestrates parsing, scoring, and LLM synthesis.
  - `/jobs` – optional persistence of job descriptions and historical analyses.
  - `/health` – service health checks for observability.
- Integrates with Azure Blob Storage for document uploads and caching.
- Uses Azure Form Recognizer (optional future enhancement) for PDF extraction.
- Aggregates scoring pipeline components:
  1. **Document normalization** – extract raw text, chunk into sections (summary, skills, experience, education).
  2. **Feature extraction** – compute embeddings with Azure `text-embedding-3-large` and keyword statistics.
  3. **Model-driven reasoning** – send structured context to `gpt-4o-mini` for holistic evaluation.

## Data Flow
1. User submits CV (text or file) and job description via React UI.
2. Frontend sends payload to `/analyze` (FastAPI) with raw text or file references.
3. Backend preprocesses documents (text extraction, chunking, metadata enrichment).
4. Embedding vectors are computed and compared to derive semantic similarity scores.
5. Backend assembles a rich prompt including:
   - Job profile summary and key requirements.
   - Candidate summary, skills, and experience timeline.
   - Numerical similarity metrics (keyword coverage, embeddings cosine similarity).
6. `gpt-4o-mini` generates structured JSON containing fit score, insights, and questions.
7. Backend validates the JSON against a Pydantic schema, logs metrics, and returns to frontend.
8. Frontend visualizes the response and optionally stores it for history.

## Deployment Considerations
- **Local development:** Docker Compose with separate containers for FastAPI, React (Vite), and mocked Azure OpenAI endpoints.
- **Cloud deployment:**
  - FastAPI on Azure App Service or Azure Container Apps.
  - React SPA on Azure Static Web Apps.
  - Storage via Azure Blob Storage and Cosmos DB/Azure Table Storage for metadata.
- **CI/CD:** GitHub Actions pipeline for linting, tests, container builds, and deployment to Azure.
- **Secrets management:** Azure Key Vault for API keys and connection strings.

## Non-Functional Requirements
- **Latency:** Cache embeddings and model responses per document pair to reduce duplicate processing.
- **Security:** Azure AD B2C authentication for frontend; backend enforces JWT validation.
- **Observability:** Integrate Azure Application Insights with FastAPI logging middleware.
- **Scalability:** Stateless API instances behind Azure Front Door; horizontal scaling based on queue length and CPU.

## Extensibility
- Plug-in alternative models (e.g., `gpt-4o`) by adjusting deployment name.
- Add recruiter collaboration features (shared notes, comments).
- Support multi-language CV parsing with translation layer using Azure Translator.
