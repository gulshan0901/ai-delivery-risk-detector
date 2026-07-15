# DeliverIQ Backend Documentation

## Overview

DeliverIQ backend is a FastAPI service that powers the Agentic Delivery Risk Copilot. It accepts live Jira issues, uploaded artifacts, or sample artifacts, normalizes them into one common artifact model, runs the OpenAI-powered multi-agent analysis, streams agent progress to the frontend, and can post generated comments back to Jira.

- API docs: https://web-production-ab950.up.railway.app/docs
- Production API base: https://web-production-ab950.up.railway.app
- Local API base: http://localhost:8000

## Runtime Stack

- FastAPI
- Uvicorn
- Pydantic
- OpenAI Responses API
- Jira Cloud REST API
- Server-Sent Events for live pipeline progress

## Deployment Entrypoint

Root `Procfile`:

```text
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Root `main.py` exposes `backend/main.py` as `main:app` for deployment platforms.

## Environment

Backend environment file:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1

JIRA_DOMAIN=your-domain.atlassian.net
JIRA_EMAIL=your_email@example.com
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEY=CMP
JIRA_JQL=project = CMP ORDER BY priority ASC, updated DESC
JIRA_MAX_RESULTS=20
```

Notes:

- Do not commit `.env`.
- The backend loads `backend/.env` through `utils/env.py`.
- If `OPENAI_API_KEY` is missing, the backend falls back to local demo analysis.

## Local Development

```powershell
cd C:\Users\gulsh\OneDrive\Documents\test\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/api/health
```

Swagger docs:

```text
http://localhost:8000/docs
```

## Source Structure

```text
backend/
|-- main.py
|-- requirements.txt
|-- services/
|   `-- jira_service.py
|-- agents/
|   |-- __init__.py
|   |-- ingestion.py
|   |-- evidence.py
|   |-- risk_analysis.py
|   |-- action_planning.py
|   `-- codex.py
|-- models/
|   |-- __init__.py
|   `-- schemas.py
`-- utils/
    |-- __init__.py
    |-- env.py
    |-- text.py
    `-- artifacts.py
```

## Module Responsibilities

### `main.py`

Thin FastAPI layer:

- App creation
- CORS
- HTTP routes
- SSE stream orchestration

### `models/schemas.py`

Pydantic models:

- `Artifact`
- `AnalyzeRequest`
- `UploadRequest`
- `CommentRequest`

### `agents/ingestion.py`

Input normalization:

- `parse_uploaded_artifact()`
- `normalize_request_artifacts()`

Handles CSV/JSON metadata enrichment and converts structured fields into the common `Artifact` shape.

### `agents/evidence.py`

Evidence and prompt context:

- `build_context()`
- `find_evidence()`

For live Jira, it adds prioritization hints for blocked, critical, overdue, unassigned, and risky labels.

### `agents/risk_analysis.py`

Main agent analysis:

- `local_agent_analysis()`
- `build_openai_prompt()`
- `run_openai_analysis()`

This is where the OpenAI call happens.

### `agents/action_planning.py`

Action and draft generation helpers:

- Agent summaries
- Recommended actions
- Recovery drafts

### `agents/codex.py`

Codex remediation helper:

- Suspected root cause
- Fix plan
- Codex patch prompt

### `services/jira_service.py`

Jira integration:

- Authentication
- Enhanced JQL search through `/rest/api/3/search/jql`
- Issue normalization
- Jira summary
- Comment posting

## API Reference

All `/api/...` endpoints also support equivalent non-API aliases where listed.

### Health

```http
GET /api/health
```

Returns backend status and mode.

Example response:

```json
{
  "ok": true,
  "mode": "openai-api",
  "model": "gpt-4.1"
}
```

Modes:

- `openai-api`: `OPENAI_API_KEY` is configured.
- `fastapi-demo`: local fallback mode.

## Sample Data

```http
GET /api/sample-data
GET /sample-data
```

Reads local files from `sample-data/` and returns them as artifacts.

Example response:

```json
{
  "source": "sample",
  "fileCount": 4,
  "artifacts": [
    {
      "name": "jira_export.csv",
      "type": "Jira CSV",
      "source": "sample",
      "badge": "Sample",
      "content": "..."
    }
  ]
}
```

Used for guaranteed demo fallback when Jira or uploads are unavailable.

## Upload

```http
POST /api/upload
POST /upload
```

Normalizes uploaded files into artifacts.

Request body:

```json
{
  "files": [
    {
      "name": "jira_export.csv",
      "type": "Jira CSV",
      "content": "Key,Summary,Status..."
    }
  ]
}
```

Response:

```json
{
  "source": "upload",
  "fileCount": 1,
  "artifacts": [
    {
      "name": "jira_export.csv",
      "type": "Jira CSV",
      "source": "upload",
      "badge": "Uploaded",
      "meta": {
        "rows": 10,
        "columns": ["Key", "Summary", "Status"],
        "preview": []
      },
      "content": "..."
    }
  ]
}
```

Supported frontend file types:

- `.txt`
- `.csv`
- `.log`
- `.md`
- `.json`

## Jira Summary

```http
GET /api/jira/summary
GET /jira/summary
```

Fetches live Jira issues and returns both summary metrics and a normalized `Jira Live` artifact.

Success response:

```json
{
  "success": true,
  "connected": true,
  "source": "live",
  "ticketCount": 10,
  "total": 10,
  "blocked": 1,
  "critical": 3,
  "stale_unassigned": 0,
  "artifacts": [
    {
      "name": "Jira Live",
      "type": "Live Jira Tickets",
      "source": "live",
      "badge": "Live",
      "meta": {
        "ticketCount": 10,
        "blocked": 1,
        "critical": 3,
        "staleUnassigned": 0
      },
      "content": "{\"issues\": [...]}"
    }
  ],
  "issues": []
}
```

Fallback response:

```json
{
  "success": false,
  "connected": false,
  "source": "live",
  "artifacts": [],
  "ticketCount": 0,
  "message": "Jira credentials are not configured."
}
```

Frontend behavior:

- If connected, the left panel shows `Jira Live`.
- If not connected, the frontend silently falls back to upload/sample options.

## Jira Issues

```http
GET /api/jira/issues
GET /jira/issues
```

Returns normalized Jira issues.

Response:

```json
{
  "success": true,
  "count": 10,
  "issues": [
    {
      "id": "CMP-7",
      "key": "CMP-7",
      "title": "Integration test suite timing out",
      "summary": "Integration test suite timing out",
      "status": "In Progress",
      "assignee": "dev-amit",
      "priority": "Critical",
      "updated": "2026-06-27T13:03:09.756+0530",
      "due_date": null,
      "duedate": null,
      "labels": ["bug", "ci-blocker"]
    }
  ]
}
```

## Jira Comment

```http
POST /api/jira/comment
POST /jira/comment
```

Posts an AI-generated comment to a real Jira issue.

Request body:

```json
{
  "issue_key": "CMP-7",
  "comment": "AI risk review: This item appears blocked..."
}
```

Response:

```json
{
  "success": true,
  "comment_id": "10001"
}
```

Frontend guard:

- The `Post to Jira` button is enabled only when the active data source is live Jira.
- Sample/upload modes show `Live Jira only`.

## Analyze

```http
POST /api/analyze
POST /analyze
```

Runs the analysis and returns the final result in one response.

Request body:

```json
{
  "source": "live",
  "artifacts": [
    {
      "name": "Jira Live",
      "type": "Live Jira Tickets",
      "source": "live",
      "badge": "Live",
      "content": "{\"issues\": [...]}"
    }
  ]
}
```

Alternative structured fields are also accepted:

```json
{
  "source": "upload",
  "jira_data": {},
  "meeting_notes": "...",
  "build_log": "...",
  "email_thread": "..."
}
```

Response shape:

```json
{
  "mode": "openai-api",
  "source": "live",
  "projectName": "CMP Jira Risk Analysis",
  "generatedAt": "2026-06-29T00:00:00Z",
  "executiveSummary": "...",
  "health": {
    "score": 75,
    "label": "At Risk",
    "trend": "Deteriorating",
    "timeSavedHours": 12,
    "confidence": 88
  },
  "agents": [],
  "risks": [],
  "recommendedActions": [],
  "drafts": {
    "executiveStatus": "...",
    "escalationEmail": "...",
    "jiraComment": "..."
  },
  "codexRemediation": {
    "suspectedRootCause": "...",
    "fixPlan": [],
    "patchPrompt": "..."
  },
  "measurement": {
    "manualStatusPrep": "3 hours",
    "copilotStatusPrep": "15 minutes",
    "blockerDetection": "Same day",
    "expectedImpact": "..."
  }
}
```

## Streaming Analyze

```http
POST /api/analyze/stream
POST /analyze/stream
```

Runs the same analysis as `/api/analyze`, but streams progress through Server-Sent Events.

This is the primary endpoint used by the frontend.

Request body:

```json
{
  "source": "live",
  "artifacts": []
}
```

SSE event examples:

```text
data: {"type":"pipeline_started","total":5}

data: {"type":"agent_started","index":0,"name":"Ingestion Agent"}

data: {"type":"agent_completed","index":0,"name":"Ingestion Agent","summary":"Parsed 1 artifact(s)."}

data: {"type":"analysis","analysis":{...}}

data: {"type":"pipeline_completed"}
```

Error event:

```text
data: {"type":"error","detail":"Analysis failed"}
```

Pipeline pacing:

- Ingestion Agent: 0.8 seconds
- Evidence Agent: 1.2 seconds
- Risk Analysis Agent: real OpenAI/local analysis call
- Action Planning Agent: 1.0 second
- Codex Remediation Agent: 0.8 seconds

## CORS

Configured origins include:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:4173
http://127.0.0.1:4173
https://hcl-hackathon-eta.vercel.app
https://hcl-hackathon-git-main-gulshan-kumars-projects-4ef932b9.vercel.app
https://hcl-hackathon-ree0ns3ab-gulshan-kumars-projects-4ef932b9.vercel.app
*
```

The wildcard is kept for hackathon convenience. Remove it for stricter production hardening.

## Demo Flow

Recommended live demo:

1. Open frontend: https://hcl-hackathon-eta.vercel.app/
2. Confirm `Jira Live` appears.
3. Click `Run agent workflow`.
4. Watch `/api/analyze/stream` drive the heartbeat.
5. Show risk cards and confidence bars.
6. Open Drafts.
7. Click `Post to Jira`.
8. Show the comment in the real Jira issue.
