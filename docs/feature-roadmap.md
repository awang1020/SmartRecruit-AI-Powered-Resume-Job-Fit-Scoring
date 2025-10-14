# Feature List & Roadmap

## Core Use Cases
1. **CV vs Job Match Analysis** – ingest two documents and return an AI-evaluated fit report.
2. **Insights & Recommendations** – highlight missing skills, strengths to emphasize, and potential red flags.
3. **Interview Preparation** – surface tailored questions for both recruiters and candidates.
4. **History & Collaboration** – allow users to track, revisit, and share analyses.

## Feature Breakdown
| Feature | Description | Priority | Dependencies |
|---------|-------------|----------|--------------|
| Document ingestion | Upload PDFs, DOCX, or paste text for CVs and job descriptions. | P0 | Storage, parsing service |
| Text extraction | Use Python libraries (PyPDF2, python-docx) or Azure Form Recognizer for structured fields. | P0 | Ingestion |
| Semantic scoring | Embedding similarity between CV sections and job requirements. | P0 | Azure OpenAI embeddings |
| LLM evaluation | `gpt-4o-mini` generates fit score, recommendations, and questions. | P0 | Prompt orchestration |
| Response validation | Enforce Pydantic schema, handle retries with `response_format` or function calling. | P0 | LLM evaluation |
| Frontend dashboard | View results, filter by job/candidate, download reports. | P1 | API endpoints |
| Authentication | Azure AD B2C or Auth0 integration for user sign-in. | P1 | Frontend + backend |
| Collaboration | Shared workspaces, comments, export to ATS. | P2 | Auth, storage |
| Analytics | Track success metrics, trending skills, candidate pools. | P2 | Data warehouse |

## Roadmap
### Phase 1 – MVP (Weeks 1-3)
- Implement FastAPI `/analyze` endpoint with text input payload.
- Integrate Azure OpenAI embeddings and `gpt-4o-mini` completion with JSON schema enforcement.
- Create React UI with text boxes for CV and job description, plus results view.
- Add unit tests for preprocessing and mock LLM responses.

### Phase 2 – Enhanced Usability (Weeks 4-6)
- Support file uploads with server-side parsing.
- Persist history per user and allow download of PDF/JSON reports.
- Introduce recruiter vs candidate interview question tabs with filtering.
- Harden system with authentication and request quotas.

### Phase 3 – Intelligence & Scale (Weeks 7-10)
- Improve scoring with weight tuning, custom keyword dictionaries, and industry templates.
- Add feedback loop where recruiters rate suggestions to refine prompts.
- Instrument analytics dashboards and performance monitoring.
- Deploy CI/CD pipelines and staging environments.

### Future Enhancements
- Multi-language support via Azure Translator.
- Integration with Applicant Tracking Systems (Greenhouse, Lever) for importing job descriptions.
- Recommendation engine to suggest alternative roles to candidates.
