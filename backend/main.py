import asyncio
import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from agents.ingestion import normalize_request_artifacts, parse_uploaded_artifact
from agents.risk_analysis import run_openai_analysis
from models.schemas import AnalyzeRequest, Artifact, CommentRequest, UploadRequest
from services.jira_service import get_issues, get_jira_summary, post_comment
from security import enforce_rate_limits
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

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if origin.strip() and origin.strip() != "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if request.method != "OPTIONS" and request.url.path not in {"/api/health", "/docs", "/openapi.json", "/redoc"}:
        origin = request.headers.get("origin", "").rstrip("/")
        normalized_origins = {item.rstrip("/") for item in allowed_origins}
        if origin not in normalized_origins:
            return JSONResponse(status_code=403, content={"detail": "Request origin is not allowed."})
        try:
            enforce_rate_limits(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
    content_length = request.headers.get("content-length")
    max_body_bytes = int(os.getenv("MAX_REQUEST_BYTES", "750000"))
    try:
        body_size = int(content_length) if content_length else 0
    except ValueError:
        return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header."})
    if body_size > max_body_bytes:
        return JSONResponse(status_code=413, content={"detail": "Request body is too large."})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


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
        raise HTTPException(status_code=502, detail="Jira request failed.") from exc


@app.post("/api/jira/comment")
@app.post("/jira/comment")
def add_jira_comment(request: CommentRequest) -> dict[str, Any]:
    try:
        result = post_comment(request.issue_key, request.comment)
        return {"success": True, "comment_id": result.get("id")}
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Jira comment could not be posted.") from exc


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
        public_detail = exc.detail if exc.status_code < 500 else "Analysis service failed."
        yield sse_event({"type": "error", "detail": public_detail})
    except Exception:
        yield sse_event({"type": "error", "detail": "Analysis service failed."})


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
