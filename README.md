# Agentic Delivery Risk Copilot

React + FastAPI hackathon project for an OpenAI-powered multi-agent delivery risk and recovery copilot.

## Pitch

Enterprise project teams lose hours reading Jira exports, meeting notes, build logs, and weekly status reports. This product analyzes those artifacts, detects delivery risk, cites the evidence, drafts recovery actions, and gives a Codex-ready remediation plan for technical blockers.

## Stack

- Frontend: React, Vite, lucide-react
- Backend: Python FastAPI
- AI: OpenAI Responses API when `OPENAI_API_KEY` is available
- Demo mode: FastAPI local analyzer when no API key is configured

## Agents

1. Ingestion Agent: normalizes uploaded artifacts.
2. Evidence Agent: finds source-backed facts and line references.
3. Risk Analysis Agent: scores delivery health and ranks threats.
4. Action Planning Agent: drafts recovery actions, Jira comments, and escalation notes.
5. Codex Remediation Agent: analyzes build/code failure signals and generates a Codex patch prompt.

## Run Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Backend health:

```text
http://localhost:8000/api/health
```

## Run Frontend

Open a second terminal.

```powershell
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Enable OpenAI API Mode

Set the key before starting FastAPI.

```powershell
$env:OPENAI_API_KEY="your_api_key_here"
$env:OPENAI_MODEL="gpt-4.1"
$env:ALLOWED_ORIGINS="http://localhost:5173,https://hcl-hackathon-eta.vercel.app"
python -m uvicorn main:app --reload --port 8000
```

Without `OPENAI_API_KEY`, the backend uses local demo mode so the presentation still works.

The application is public and users enter no credentials. All features remain enabled: sample
analysis, uploads, custom analysis, Jira reads, and Jira comments. The backend accepts application
requests only when the browser `Origin` exactly matches an entry in `ALLOWED_ORIGINS`.

For the hosted demo, use an exact `ALLOWED_ORIGINS` list and least-privilege Jira credentials.
Origin validation and CORS prevent ordinary browser requests from other websites, but they are not
authentication: non-browser clients can forge an `Origin` header. Set an OpenAI project budget as
the final spending safeguard. API traffic is limited per client to `API_RATE_LIMIT_PER_MINUTE`
(default `30`) and `API_RATE_LIMIT_PER_HOUR` (default `300`).

## Demo Flow

1. Click `Load sample artifacts`.
2. Click `Run agent workflow`.
3. Show delivery health score, top risks, source evidence, agent completion strip, recovery actions, Codex remediation plan, and generated drafts.
4. Explain measurable impact: status prep from 3 hours to 15 minutes, same-day blocker detection, and evidence-backed recovery planning.

## Hackathon Judging Fit

- Innovation: multi-agent project delivery command center, not a generic chatbot.
- Impact: measurable time saved and earlier risk detection.
- Relevance: targets enterprise delivery, client escalation, QA readiness, and build blockers.
- OpenAI usage: Responses API, structured outputs, agent orchestration, and Codex remediation.
- Technical excellence: React dashboard, FastAPI API contract, clear data model, demo fallback.
- Scalability: reusable across accounts, projects, tool exports, and delivery portfolios.
