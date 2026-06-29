import csv
import io
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from agents.action_planning import agent_summaries, recommended_actions, recovery_drafts
from agents.codex import codex_remediation
from agents.evidence import build_context, find_evidence
from models.schemas import Artifact
from utils.text import clamp, count_matches, strip_json_fence


PROMPT_ARTIFACT_CHARS = 60_000


def infer_project_name(text: str) -> str:
    jira_keys = re.findall(r'"key"\s*:\s*"([A-Z][A-Z0-9]+)-\d+"', text)
    if jira_keys:
        return f"{jira_keys[0].split('-')[0]} Jira Risk Analysis"

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


def local_agent_analysis(artifacts: list[Artifact], source: str = "upload") -> dict[str, Any]:
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
        "source": source,
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
        "agents": agent_summaries(len(artifacts)),
        "risks": risks,
        "recommendedActions": recommended_actions(),
        "drafts": recovery_drafts(),
        "codexRemediation": codex_remediation(),
        "measurement": {
            "manualStatusPrep": "3 hours",
            "copilotStatusPrep": "15 minutes",
            "blockerDetection": "Same day",
            "expectedImpact": "Earlier escalation, faster recovery planning, and evidence-backed status reporting.",
        },
    }


def build_openai_prompt(artifacts: list[Artifact], source: str = "upload") -> str:
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
        f"FILE: {artifact.name}\nTYPE: {artifact.type}\nSOURCE: {artifact.source or source}\n{prompt_content(artifact)}"
        for artifact in artifacts
    )
    context = build_context(artifacts, source)
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

Context:
{context}

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


def run_openai_analysis(artifacts: list[Artifact], source: str = "upload") -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return local_agent_analysis(artifacts, source)

    request_body = json.dumps(
        {
            "model": os.getenv("OPENAI_MODEL", "gpt-4.1"),
            "input": build_openai_prompt(artifacts, source),
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
        result = json.loads(strip_json_fence(output_text))
        result.setdefault("source", source)
        return result
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI returned invalid JSON: {output_text[:300]}") from exc
