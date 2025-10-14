# API Design, Prompting, and Output

## Input Processing Strategy
- **Frontend:**
  - Textareas for copy/paste of job description and CV for quick evaluations.
  - Optional file upload inputs (`.pdf`, `.docx`, `.txt`) handled via multipart requests.
  - Client-side validation to enforce size limits (e.g., 5 MB) and warn about personally identifiable information.
- **Backend:**
  - For file uploads, leverage `python-multipart` in FastAPI and temporary storage in Azure Blob Storage.
  - Use `pdfminer.six` or `PyPDF2` for PDFs and `python-docx` for Word documents.
  - Normalize whitespace, remove headers/footers, and split into semantic sections (summary, skills, experience, education).
  - Detect language and translate if necessary (future enhancement).

## Data Structures
```python
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class DocumentPayload(BaseModel):
    job_title: str
    job_description: str
    candidate_name: Optional[str]
    candidate_resume: str
    locale: Literal["en-US", "en-GB", "fr-FR"] = "en-US"

class SimilarityFeature(BaseModel):
    label: str
    weight: float
    score: float

class AnalysisResult(BaseModel):
    fit_score: int = Field(ge=0, le=100)
    summary: str
    strengths: List[str]
    gaps: List[str]
    recruiter_questions: List[str]
    candidate_questions: List[str]
    similarity_breakdown: List[SimilarityFeature]
    metadata: dict
```

## Prompt Engineering Approach
- **System Prompt:** Define evaluator persona, scoring rubric, and response schema.
- **Context Blocks:**
  1. Job description summary + extracted requirements (skills, responsibilities, must-have vs nice-to-have).
  2. Candidate resume summary + timeline with quantified achievements when available.
  3. Pre-computed metrics (embedding cosine similarity, keyword coverage).
- **Few-Shot Examples:** Provide 1-2 synthetic scenarios demonstrating ideal JSON output and rubric adherence.
- **Response Format Enforcement:** Use the Azure OpenAI `response_format={"type": "json_schema", ...}` setting to guarantee parseable JSON.

### Example System Prompt
```
You are SmartRecruit, an expert talent intelligence analyst.
Evaluate how well a candidate matches a job description.
Scoring rubric:
- 90-100: Candidate meets critical skills, relevant experience, and culture indicators.
- 70-89: Strong fit with minor gaps; provide actionable coaching.
- 40-69: Partial fit; highlight critical missing competencies.
- 0-39: Poor fit; recommend alternative focus areas.
Respond in JSON following the provided schema. Include balanced interview questions for both recruiter and candidate.
```

### Example Few-Shot Snippet
```
<example>
{
  "fit_score": 82,
  "summary": "Experienced backend engineer aligns with microservices role, needs deeper Azure exposure.",
  "strengths": ["5+ years in Python APIs", "Solid CI/CD track record"],
  "gaps": ["Limited Azure service experience"],
  "recruiter_questions": ["Can you describe your experience deploying to Azure App Service?"],
  "candidate_questions": ["How does the team handle on-call rotations?"],
  "similarity_breakdown": [
    {"label": "Core skills", "weight": 0.4, "score": 0.85},
    {"label": "Domain experience", "weight": 0.35, "score": 0.75},
    {"label": "Soft skills", "weight": 0.25, "score": 0.8}
  ],
  "metadata": {"model_version": "gpt-4o-mini"}
}
</example>
```

## Scoring Logic
1. **Keyword Coverage (30%)** – Extract required vs optional keywords, compute coverage ratio with TF-IDF weighting.
2. **Semantic Similarity (40%)** – Average cosine similarity between job requirement embeddings and resume sections using Azure embeddings.
3. **Experience Alignment (20%)** – Evaluate overlap in years of experience per skill or domain using rule-based heuristics.
4. **Soft Skill & Culture Fit (10%)** – Identify soft skills and company values mentioned.
5. Combine weighted scores to produce a preliminary numerical score, then allow `gpt-4o-mini` to adjust within ±10 points based on qualitative analysis.
6. Provide transparency by returning component scores in `similarity_breakdown`.

## FastAPI Endpoint Example
```python
from fastapi import APIRouter, Depends
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

router = APIRouter(prefix="/api")

client = AzureOpenAI(
    api_version="2024-02-01",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_ad_token_provider=DefaultAzureCredential()
)

def get_completion(messages, response_schema):
    return client.responses.create(
        model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
        input=messages,
        response_format={"type": "json_schema", "json_schema": response_schema},
        temperature=0.2
    )

@router.post("/analyze", response_model=AnalysisResult)
async def analyze(payload: DocumentPayload):
    features = compute_similarity_features(payload)
    prompt_messages = build_messages(payload, features)
    schema = AnalysisResult.model_json_schema()
    response = get_completion(prompt_messages, schema)
    parsed = AnalysisResult.model_validate_json(response.output[0].content[0].text)
    return parsed
```

## Example Response JSON
```json
{
  "fit_score": 76,
  "summary": "The candidate brings strong full-stack experience but lacks direct Azure DevOps exposure required for this role.",
  "strengths": [
    "Delivered multiple React/Node platforms end-to-end",
    "Quantified impact on performance and user growth"
  ],
  "gaps": [
    "Limited hands-on experience with Azure Pipelines",
    "No evidence of managing large-scale data integrations"
  ],
  "recruiter_questions": [
    "Can you walk me through a time you automated deployment pipelines?",
    "How have you handled stakeholder alignment across distributed teams?"
  ],
  "candidate_questions": [
    "What are the first 90-day success metrics for this role?",
    "How mature is the team's cloud infrastructure and monitoring?"
  ],
  "similarity_breakdown": [
    {"label": "Core technical skills", "weight": 0.4, "score": 0.72},
    {"label": "Domain experience", "weight": 0.3, "score": 0.68},
    {"label": "Soft skills", "weight": 0.2, "score": 0.8},
    {"label": "Certifications", "weight": 0.1, "score": 0.6}
  ],
  "metadata": {
    "model_version": "gpt-4o-mini",
    "job_title": "Senior Full-Stack Engineer",
    "candidate_name": "Taylor Morgan"
  }
}
```

## Improving Model Output Quality
- Iterate on few-shot examples highlighting both strong and weak matches to calibrate scoring language.
- Provide explicit JSON schema with enums and regex validation for consistent formatting.
- Capture structured metadata (skills taxonomy, experience years) to reduce hallucinations.
- Implement automatic retries with stricter system instructions if the first response fails schema validation.
- Log user feedback on helpfulness to refine prompt weighting and question generation.
