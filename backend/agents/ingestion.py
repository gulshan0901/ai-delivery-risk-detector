import json
from pathlib import Path

from models.schemas import AnalyzeRequest, Artifact
from utils.artifacts import artifact_type_for, source_label, summarize_csv


def parse_uploaded_artifact(file: Artifact, source: str = "upload") -> Artifact:
    name = file.name
    suffix = Path(name).suffix.lower()
    content = file.content
    meta: dict = dict(file.meta or {})

    # Keep the original artifact text for analysis, but enrich known formats for UI/debugging.
    if suffix == ".csv":
        meta.update(summarize_csv(content))
    elif suffix == ".json":
        try:
            parsed = json.loads(content)
            content = json.dumps(parsed, indent=2, ensure_ascii=False)
            meta["jsonType"] = type(parsed).__name__
        except json.JSONDecodeError:
            meta["jsonWarning"] = "Could not parse JSON; preserved as raw text."

    return Artifact(
        name=name,
        type=file.type or artifact_type_for(name),
        content=content,
        source=source,
        badge=source_label(source),
        meta=meta or None,
    )


def normalize_request_artifacts(request: AnalyzeRequest) -> list[Artifact]:
    source = request.source or "upload"
    artifacts = [parse_uploaded_artifact(artifact, source=artifact.source or source) for artifact in request.artifacts]

    # /analyze accepts either prebuilt artifacts or structured fields from live/upload/sample flows.
    if request.jira_data is not None:
        artifacts.append(
            Artifact(
                name="jira_live.json" if source == "live" else "jira_data.json",
                type="Jira Live" if source == "live" else "Jira Data",
                content=json.dumps(request.jira_data, indent=2, ensure_ascii=False),
                source=source,
                badge=source_label(source),
            )
        )

    if request.meeting_notes:
        artifacts.append(
            Artifact(
                name="meeting_notes.txt",
                type="Meeting Notes",
                content=request.meeting_notes,
                source=source,
                badge=source_label(source),
            )
        )

    if request.build_log:
        artifacts.append(
            Artifact(
                name="build_log.txt",
                type="Build Log",
                content=request.build_log,
                source=source,
                badge=source_label(source),
            )
        )

    if request.email_thread:
        artifacts.append(
            Artifact(
                name="email_thread.txt",
                type="Email Thread",
                content=request.email_thread,
                source=source,
                badge=source_label(source),
            )
        )

    return artifacts
