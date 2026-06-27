import asyncio
import csv
import io
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")
MAX_ARTIFACT_CHARS = 500_000
PROMPT_ARTIFACT_CHARS = 60_000
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Artifact(BaseModel):
    name: str = Field(..., max_length=160)
    type: str | None = Field(default="Artifact", max_length=80)
    content: str = Field(..., max_length=MAX_ARTIFACT_CHARS)


class AnalyzeRequest(BaseModel):
    artifacts: list[Artifact]


def sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def count_matches(text: str, patterns: list[str]) -> int:
    return sum(len(re.findall(pattern, text, flags=re.IGNORECASE)) for pattern in patterns)


def clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def infer_project_name(text: str) -> str:
    match = re.search(r"project\s*[:=-]\s*([A-Za-z0-9 _-]+)", text, flags=re.IGNORECASE)
    if match:
        candidate = match.group(1).strip()[:60]
        if candidate and not candidate.lower().startswith("owner-"):
            return candidate

    try:
        csv_text = text[:80_000]
        lines = csv_text.splitlines()
        header_index = next(
            (
                index
                for index, line in enumerate(lines)
                if "Area Path" in line and ("Work Item Type" in line or "Iteration Path" in line)
            ),
            0,
        )
        reader = csv.DictReader(io.StringIO("\n".join(lines[header_index:])))
        first_row = next(reader, None)
        if first_row:
            for column in ("Area Path", "Iteration Path"):
                value = (first_row.get(column) or "").strip()
                if value:
                    return value.split("\\")[0].split("/")[0].strip()[:60]
    except csv.Error:
        pass

    return "Phoenix Delivery Program"


def find_evidence(artifacts: list[Artifact], keywords: list[str], limit: int = 4) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    lowered_keywords = [keyword.lower() for keyword in keywords]

    for artifact in artifacts:
        for index, line in enumerate(artifact.content.splitlines(), start=1):
            clean_line = line.strip()
            if not clean_line:
                continue
            if any(keyword in clean_line.lower() for keyword in lowered_keywords):
                evidence.append(
                    {
                        "source": artifact.name,
                        "line": index,
                        "quote": clean_line[:260],
                    }
                )
            if len(evidence) >= limit:
                return evidence

    return [
        {
            "source": "Uploaded artifacts",
            "line": 1,
            "quote": "No exact keyword match found; this signal is inferred from the overall project context.",
        }
    ]


def local_agent_analysis(artifacts: list[Artifact]) -> dict[str, Any]:
    combined = "\n\n".join(f"### {artifact.name}\n{artifact.content}" for artifact in artifacts)
    blocker_count = count_matches(combined, [r"\bblocked\b", r"\bblocker\b", r"\bdependency\b", r"\bwaiting\b"])
    failure_count = count_matches(combined, [r"\bfailed\b", r"\berror\b", r"\bexception\b", r"\btimeout\b", r"\bbuild\b"])
    escalation_count = count_matches(combined, [r"escalat", r"client concern", r"\brisk\b", r"\bdelay\b"])
    ownership_count = count_matches(combined, [r"\bunassigned\b", r"owner missing", r"no owner", r"\btbd\b"])
    stale_count = count_matches(combined, [r"8 days", r"7 days", r"\bstale\b", r"\boverdue\b", r"past due"])
    score = clamp(42 + blocker_count * 8 + failure_count * 6 + escalation_count * 7 + ownership_count * 9 + stale_count * 8, 0, 96)

    risks = [
        {
            "title": "Critical integration dependency is blocking delivery",
            "severity": "High" if blocker_count > 1 else "Medium",
            "confidence": 91 if blocker_count > 1 else 78,
            "owner": "Integration Lead",
            "businessImpact": "Payment and onboarding milestones can miss the sprint commitment if dependency ownership is not resolved.",
            "evidence": find_evidence(artifacts, ["blocked", "dependency", "waiting", "API"]),
            "recommendedAction": "Escalate the dependency today, assign a named owner, and create a 24-hour recovery checkpoint.",
        },
        {
            "title": "Build failure is masking release readiness",
            "severity": "High" if failure_count > 1 else "Medium",
            "confidence": 89 if failure_count > 1 else 72,
            "owner": "Engineering Lead",
            "businessImpact": "QA cannot validate the latest increment until the pipeline is restored.",
            "evidence": find_evidence(artifacts, ["failed", "error", "exception", "build"]),
            "recommendedAction": "Run dependency lockfile validation, reproduce locally, and ask Codex remediation agent to propose a patch.",
        },
        {
            "title": "Status governance is weak due to missing ownership",
            "severity": "High" if ownership_count > 0 else "Low",
            "confidence": 86 if ownership_count > 0 else 64,
            "owner": "Project Manager",
            "businessImpact": "Unowned work items create late discovery and reduce confidence in the weekly client update.",
            "evidence": find_evidence(artifacts, ["unassigned", "owner", "TBD", "missing"]),
            "recommendedAction": "Assign each open blocker to a named owner and publish next action dates before the next standup.",
        },
    ]

    return {
        "mode": "fastapi-demo",
        "projectName": infer_project_name(combined),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "executiveSummary": (
            "The project shows elevated delivery risk driven by an unresolved integration dependency, "
            "a failing build, and weak ownership signals. Immediate escalation and a 24-hour recovery "
            "plan are recommended."
        ),
        "health": {
            "score": score,
            "label": "At Risk" if score >= 75 else "Watch" if score >= 55 else "Healthy",
            "trend": "Deteriorating",
            "timeSavedHours": 2.75,
            "confidence": 88,
        },
        "agents": [
            {"name": "Ingestion Agent", "status": "Complete", "summary": f"Parsed {len(artifacts)} project artifacts."},
            {"name": "Evidence Agent", "status": "Complete", "summary": "Extracted blockers, failed builds, stale work, and ownership gaps."},
            {"name": "Risk Analysis Agent", "status": "Complete", "summary": "Calculated risk score and severity-ranked delivery threats."},
            {"name": "Action Planning Agent", "status": "Complete", "summary": "Generated escalation, Jira update, and recovery plan drafts."},
            {"name": "Codex Remediation Agent", "status": "Complete", "summary": "Analyzed build failure signals and proposed technical remediation."},
        ],
        "risks": risks,
        "recommendedActions": [
            "Create a recovery war-room for the integration blocker with PM, engineering lead, and dependency owner.",
            "Update Jira with owner, due date, blocker reason, and next checkpoint for every high-risk item.",
            "Run build remediation on the failing module and attach the root-cause summary to the release ticket.",
            "Send client-safe status note with risk, impact, recovery action, and next update time.",
        ],
        "drafts": {
            "executiveStatus": (
                "Current delivery health is At Risk. The main driver is an unresolved integration dependency "
                "combined with a failing build that blocks QA validation. Recovery plan: assign dependency owner "
                "today, restore build pipeline, and provide a checkpoint update within 24 hours."
            ),
            "escalationEmail": (
                "Subject: Action Required: Delivery Risk on Integration Dependency\n\n"
                "Hi Team,\n\n"
                "The delivery copilot has identified a high-risk integration blocker with downstream impact on QA "
                "and sprint commitments. Please assign a dependency owner today, confirm the next fix window, and "
                "join a 24-hour recovery checkpoint.\n\n"
                "Recommended next actions:\n"
                "1. Confirm owner and ETA for the blocked integration.\n"
                "2. Restore the failing build and attach root cause to the release ticket.\n"
                "3. Update Jira with blocker reason, due date, and next checkpoint.\n\n"
                "Regards,\nDelivery Risk Copilot"
            ),
            "jiraComment": (
                "AI risk review: This item appears blocked and may impact release readiness. Please update owner, "
                "dependency, expected resolution date, and next validation step. Suggested severity: High."
            ),
        },
        "codexRemediation": {
            "suspectedRootCause": "Dependency or environment mismatch is causing the build pipeline to fail before QA validation.",
            "fixPlan": [
                "Reproduce the failing command locally with the same Node/runtime version as CI.",
                "Check lockfile drift and dependency version mismatches.",
                "Add a regression test around the failing module after the dependency fix.",
                "Re-run CI and attach the remediation note to the release ticket.",
            ],
            "patchPrompt": (
                "Use Codex to inspect the failing module, dependency lockfile, and test output. Generate the smallest "
                "patch that restores the build and adds a regression test."
            ),
        },
        "measurement": {
            "manualStatusPrep": "3 hours",
            "copilotStatusPrep": "15 minutes",
            "blockerDetection": "Same day",
            "expectedImpact": "Earlier escalation, faster recovery planning, and evidence-backed status reporting.",
        },
    }


def build_openai_prompt(artifacts: list[Artifact]) -> str:
    def prompt_content(artifact: Artifact) -> str:
        content = artifact.content
        if len(content) <= PROMPT_ARTIFACT_CHARS:
            return content

        head = content[: int(PROMPT_ARTIFACT_CHARS * 0.72)]
        tail = content[-int(PROMPT_ARTIFACT_CHARS * 0.18) :]
        omitted = len(content) - len(head) - len(tail)
        return (
            f"{head}\n\n"
            f"[... {omitted} characters omitted from large artifact. "
            f"Analyze visible rows and infer risk patterns from provided columns ...]\n\n"
            f"{tail}"
        )

    serialized_artifacts = "\n\n---\n\n".join(
        f"FILE: {artifact.name}\nTYPE: {artifact.type}\n{prompt_content(artifact)}"
        for artifact in artifacts
    )
    return f"""
You are an OpenAI-powered multi-agent delivery risk copilot for enterprise project delivery.

Use these logical agents:
1. Ingestion Agent: normalize project artifacts.
2. Evidence Agent: extract facts with source and line references.
3. Risk Analysis Agent: score delivery risk and identify top risks.
4. Action Planning Agent: create recovery actions, status drafts, and Jira comments.
5. Codex Remediation Agent: inspect technical failure signals and propose code/build remediation.

Return only valid JSON with this exact top-level shape:
{{
  "mode": "openai-api",
  "projectName": "string",
  "generatedAt": "ISO timestamp",
  "executiveSummary": "string",
  "health": {{"score": 0, "label": "Healthy|Watch|At Risk|Critical", "trend": "Improving|Stable|Deteriorating", "timeSavedHours": 0, "confidence": 0}},
  "agents": [{{"name": "string", "status": "Complete", "summary": "string"}}],
  "risks": [{{"title": "string", "severity": "Low|Medium|High|Critical", "confidence": 0, "owner": "string", "businessImpact": "string", "evidence": [{{"source": "string", "line": 0, "quote": "string"}}], "recommendedAction": "string"}}],
  "recommendedActions": ["string"],
  "drafts": {{"executiveStatus": "string", "escalationEmail": "string", "jiraComment": "string"}},
  "codexRemediation": {{"suspectedRootCause": "string", "fixPlan": ["string"], "patchPrompt": "string"}},
  "measurement": {{"manualStatusPrep": "string", "copilotStatusPrep": "string", "blockerDetection": "string", "expectedImpact": "string"}}
}}

Use evidence from the files. Be specific, measurable, and enterprise-relevant.

Artifacts:
{serialized_artifacts}
"""


def extract_response_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]

    chunks: list[str] = []
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                chunks.append(content["text"])
    return "\n".join(chunks)


def strip_json_fence(text: str) -> str:
    clean = text.strip()
    clean = re.sub(r"^```json\s*", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"^```\s*", "", clean)
    clean = re.sub(r"\s*```$", "", clean)
    return clean.strip()


def run_openai_analysis(artifacts: list[Artifact]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return local_agent_analysis(artifacts)

    request_body = json.dumps(
        {
            "model": OPENAI_MODEL,
            "input": build_openai_prompt(artifacts),
            "text": {"format": {"type": "json_object"}},
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=request_body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8")
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {details}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI API connection failed: {exc.reason}") from exc

    output_text = extract_response_text(payload)
    if not output_text:
        raise HTTPException(status_code=502, detail="OpenAI response did not contain output text.")

    try:
        return json.loads(strip_json_fence(output_text))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI returned invalid JSON: {output_text[:300]}") from exc


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "mode": "openai-api" if os.getenv("OPENAI_API_KEY") else "fastapi-demo",
        "model": OPENAI_MODEL,
    }


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    if not request.artifacts:
        raise HTTPException(status_code=400, detail="Upload or load at least one artifact.")
    return run_openai_analysis(request.artifacts)


async def stream_agent_analysis(artifacts: list[Artifact]):
    try:
      yield sse_event({"type": "pipeline_started", "total": len(AGENT_SEQUENCE)})

      yield sse_event({"type": "agent_started", "index": 0, "name": AGENT_SEQUENCE[0]})
      await asyncio.sleep(0.2)
      yield sse_event(
          {
              "type": "agent_completed",
              "index": 0,
              "name": AGENT_SEQUENCE[0],
              "summary": f"Parsed {len(artifacts)} artifact(s).",
          }
      )

      yield sse_event({"type": "agent_started", "index": 1, "name": AGENT_SEQUENCE[1]})
      await asyncio.sleep(0.2)
      yield sse_event(
          {
              "type": "agent_completed",
              "index": 1,
              "name": AGENT_SEQUENCE[1],
              "summary": "Prepared evidence extraction context.",
          }
      )

      yield sse_event({"type": "agent_started", "index": 2, "name": AGENT_SEQUENCE[2]})
      analysis = await asyncio.to_thread(run_openai_analysis, artifacts)
      yield sse_event(
          {
              "type": "agent_completed",
              "index": 2,
              "name": AGENT_SEQUENCE[2],
              "summary": "Calculated delivery risk score and ranked threats.",
          }
      )

      yield sse_event({"type": "agent_started", "index": 3, "name": AGENT_SEQUENCE[3]})
      await asyncio.sleep(0.2)
      yield sse_event(
          {
              "type": "agent_completed",
              "index": 3,
              "name": AGENT_SEQUENCE[3],
              "summary": "Generated recovery actions and stakeholder drafts.",
          }
      )

      yield sse_event({"type": "agent_started", "index": 4, "name": AGENT_SEQUENCE[4]})
      await asyncio.sleep(0.2)
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
async def analyze_stream(request: AnalyzeRequest):
    if not request.artifacts:
        raise HTTPException(status_code=400, detail="Upload or load at least one artifact.")

    return StreamingResponse(
        stream_agent_analysis(request.artifacts),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
