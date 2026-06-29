import asyncio
import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from agents.ingestion import normalize_request_artifacts, parse_uploaded_artifact
from agents.risk_analysis import run_openai_analysis
from models.schemas import AnalyzeRequest, Artifact, CommentRequest, UploadRequest
from services.jira_service import get_issues, get_jira_summary, post_comment
from utils.artifacts import sample_artifacts
from utils.env import load_env_file


load_env_file()

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")
AGENT_SEQUENCE = [
    "Ingestion Agent",
    "Evidence Agent",
    "Risk Analysis Agent",
    "Action Planning Agent",
    "Codex Remediation Agent",
]

app = FastAPI(
    title="Agentic Delivery Risk Copilot API",
    description="FastAPI backend for OpenAI-powered delivery risk analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "https://hcl-hackathon-eta.vercel.app",
        "https://hcl-hackathon-git-main-gulshan-kumars-projects-4ef932b9.vercel.app",
        "https://hcl-hackathon-ree0ns3ab-gulshan-kumars-projects-4ef932b9.vercel.app",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "mode": "openai-api" if os.getenv("OPENAI_API_KEY") else "fastapi-demo",
        "model": OPENAI_MODEL,
    }


@app.get("/api/sample-data")
@app.get("/sample-data")
def get_sample_data() -> dict[str, Any]:
    artifacts = sample_artifacts(parse_uploaded_artifact)
    return {
        "source": "sample",
        "artifacts": [artifact.model_dump() for artifact in artifacts],
        "fileCount": len(artifacts),
    }


@app.post("/api/upload")
@app.post("/upload")
def upload(request: UploadRequest) -> dict[str, Any]:
    artifacts = [parse_uploaded_artifact(file, source="upload") for file in request.files]
    return {
        "source": "upload",
        "artifacts": [artifact.model_dump() for artifact in artifacts],
        "fileCount": len(artifacts),
    }


@app.get("/api/jira/summary")
@app.get("/jira/summary")
def jira_summary() -> dict[str, Any]:
    return get_jira_summary()


@app.get("/api/jira/issues")
@app.get("/jira/issues")
def fetch_jira_issues() -> dict[str, Any]:
    try:
        issues = get_issues(max_results=int(os.getenv("JIRA_MAX_RESULTS", "20")))
        return {"success": True, "issues": issues, "count": len(issues)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/jira/comment")
@app.post("/jira/comment")
def add_jira_comment(request: CommentRequest) -> dict[str, Any]:
    try:
        result = post_comment(request.issue_key, request.comment)
        return {"success": True, "comment_id": result.get("id")}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/analyze")
@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    artifacts = normalize_request_artifacts(request)
    if not artifacts:
        raise HTTPException(status_code=400, detail="Upload or load at least one artifact.")
    return run_openai_analysis(artifacts, request.source)


async def stream_agent_analysis(artifacts: list[Artifact], source: str = "upload"):
    try:
        yield sse_event({"type": "pipeline_started", "total": len(AGENT_SEQUENCE)})

        yield sse_event({"type": "agent_started", "index": 0, "name": AGENT_SEQUENCE[0]})
        await asyncio.sleep(0.8)
        yield sse_event(
            {
                "type": "agent_completed",
                "index": 0,
                "name": AGENT_SEQUENCE[0],
                "summary": f"Parsed {len(artifacts)} artifact(s).",
            }
        )

        yield sse_event({"type": "agent_started", "index": 1, "name": AGENT_SEQUENCE[1]})
        await asyncio.sleep(1.2)
        yield sse_event(
            {
                "type": "agent_completed",
                "index": 1,
                "name": AGENT_SEQUENCE[1],
                "summary": "Prepared evidence extraction context.",
            }
        )

        yield sse_event({"type": "agent_started", "index": 2, "name": AGENT_SEQUENCE[2]})
        analysis = await asyncio.to_thread(run_openai_analysis, artifacts, source)
        yield sse_event(
            {
                "type": "agent_completed",
                "index": 2,
                "name": AGENT_SEQUENCE[2],
                "summary": "Calculated delivery risk score and ranked threats.",
            }
        )

        yield sse_event({"type": "agent_started", "index": 3, "name": AGENT_SEQUENCE[3]})
        await asyncio.sleep(1.0)
        yield sse_event(
            {
                "type": "agent_completed",
                "index": 3,
                "name": AGENT_SEQUENCE[3],
                "summary": "Generated recovery actions and stakeholder drafts.",
            }
        )

        yield sse_event({"type": "agent_started", "index": 4, "name": AGENT_SEQUENCE[4]})
        await asyncio.sleep(0.8)
        yield sse_event(
            {
                "type": "agent_completed",
                "index": 4,
                "name": AGENT_SEQUENCE[4],
                "summary": "Prepared Codex remediation guidance.",
            }
        )

        yield sse_event({"type": "analysis", "analysis": analysis})
        yield sse_event({"type": "pipeline_completed"})
    except HTTPException as exc:
        yield sse_event({"type": "error", "detail": exc.detail})
    except Exception as exc:
        yield sse_event({"type": "error", "detail": str(exc)})


@app.post("/api/analyze/stream")
@app.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    artifacts = normalize_request_artifacts(request)
    if not artifacts:
        raise HTTPException(status_code=400, detail="Upload or load at least one artifact.")

    return StreamingResponse(
        stream_agent_analysis(artifacts, request.source),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
