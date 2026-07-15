# DeliverIQ Frontend Documentation

## Overview

DeliverIQ is the React/Vite frontend for the Agentic Delivery Risk Copilot. It presents a command-center UI for loading live Jira data, uploading project artifacts, running the multi-agent workflow, reviewing risk evidence, and posting AI-generated comments back to Jira.

- Production frontend: https://hcl-hackathon-eta.vercel.app/
- Backend API base: configured with `VITE_API_URL`
- Local fallback API base: `http://localhost:8000`

## Runtime Stack

- React 18
- Vite
- Lucide React icons
- Plain CSS in `src/styles.css`
- FastAPI backend over JSON and Server-Sent Events

## Environment

Frontend environment file:

```env
VITE_API_URL=https://web-production-ab950.up.railway.app
VITE_MAX_UPLOAD_CHARS=180000
```

`VITE_API_URL` controls all backend requests. Update this value when changing environments.

## Local Development

```powershell
cd C:\Users\gulsh\OneDrive\Documents\test\frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Production build:

```powershell
npm run build
```

## Source Structure

```text
frontend/src/
|-- App.jsx
|-- main.jsx
|-- styles.css
|-- sampleArtifacts.js
|-- constants/
|   |-- agents.js
|   `-- config.js
|-- hooks/
|   |-- useAnalysis.js
|   `-- useJira.js
|-- utils/
|   |-- artifacts.js
|   |-- formatting.js
|   `-- sse.js
`-- components/
    |-- ActionsView.jsx
    |-- AgentPipeline.jsx
    |-- ArtifactPanel.jsx
    |-- BrandLogo.jsx
    |-- CodexView.jsx
    |-- DraftsView.jsx
    |-- Empty.jsx
    |-- EvidenceView.jsx
    |-- HealthSparkline.jsx
    |-- RiskView.jsx
    `-- Signal.jsx
```

## Key Responsibilities

### `App.jsx`

Thin composition layer. It assembles:

- Hero section
- DeliverIQ brand
- Delivery health summary
- Artifact panel
- Agent pipeline
- Tabs for Risks, Evidence, Actions, Codex, and Drafts

State and business logic are delegated to hooks and components.

### `hooks/useAnalysis.js`

Owns the main workflow state:

- Loads live Jira on page load
- Handles file upload and drag/drop
- Loads sample artifacts
- Runs `/api/analyze/stream`
- Tracks pipeline state from SSE messages
- Updates analysis output and ROI metrics

Important behavior:

- If no live/uploaded artifacts exist, it falls back to sample data.
- Loading state starts immediately on button click so the UI feels responsive.
- SSE chunks are buffered because messages may arrive split across network reads.

### `hooks/useJira.js`

Small API wrapper for Jira-specific backend calls:

- `loadLiveJira()`
- `postToJira(issueKey, comment)`

### `components/ArtifactPanel.jsx`

Left panel:

- ROI cards
- Live Jira status
- Upload zone
- File list
- Sample/upload/live badges

### `components/AgentPipeline.jsx`

Live agent heartbeat:

- Ingestion
- Evidence
- Risk Analysis
- Action Planning
- Codex Remediation

During a new workflow run, the pipeline trusts live SSE counters instead of previous results, so colors reset correctly.

### `components/RiskView.jsx`

Risk cards with:

- Severity pill
- Owner
- AI confidence bar
- Business impact
- Recommended action

Confidence color logic:

- Red: confidence > 80
- Amber: confidence > 60
- Blue: lower confidence

### `components/DraftsView.jsx`

Draft artifacts:

- Escalation email
- Executive status brief
- Jira update cards
- `Post to Jira` button

Posting is enabled only when the current data source is live Jira. Sample and uploaded artifacts show a disabled `Live Jira only` button.

## Data Source Flow

### Live Jira

On page load:

```text
GET /api/jira/summary
```

If connected, the frontend loads a `Jira Live` artifact and marks `dataSource = "live"`.

### Upload

User uploads TXT, CSV, LOG, MD, or JSON files:

```text
POST /api/upload
```

The backend normalizes uploaded files into the same artifact shape as live/sample data.

### Sample

User clicks `Load sample artifacts`:

```text
GET /api/sample-data
```

The backend returns the guaranteed demo dataset.

### Analyze

All paths run through the same streaming endpoint:

```text
POST /api/analyze/stream
```

The frontend receives agent progress and final analysis through Server-Sent Events.

## Deployment Notes

The current production frontend is deployed at:

```text
https://hcl-hackathon-eta.vercel.app/
```

For Vercel:

- Set `VITE_API_URL` to the Railway backend URL.
- Rebuild after changing Vite environment variables.
- Ensure backend CORS allows the Vercel domain.

## Demo Path

Recommended live demo sequence:

1. Open the production frontend.
2. Confirm `Jira Live` appears in the artifact panel.
3. Click `Run agent workflow`.
4. Watch the live pipeline heartbeat.
5. Open `Risks` and show confidence bars.
6. Open `Drafts`.
7. Click `Post to Jira` on a Jira card.
8. Show the comment in the real Jira board.
