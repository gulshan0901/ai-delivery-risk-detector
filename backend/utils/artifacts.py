import csv
import io
from pathlib import Path
from typing import Any

from models.schemas import Artifact


SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "sample-data"


def source_label(source: str | None) -> str:
    labels = {"sample": "Sample", "upload": "Uploaded", "live": "Live"}
    return labels.get((source or "").lower(), "Artifact")


def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def artifact_type_for(name: str) -> str:
    suffix = Path(name).suffix.lower()
    if suffix == ".csv":
        return "Jira CSV"
    if suffix == ".log":
        return "Build Log"
    if suffix == ".json":
        return "JSON"
    if "meeting" in name.lower():
        return "Meeting Notes"
    if "email" in name.lower():
        return "Email Thread"
    if "build" in name.lower():
        return "Build Log"
    return "Artifact"


def summarize_csv(content: str) -> dict[str, Any]:
    try:
        sample = content[:80_000]
        reader = csv.DictReader(io.StringIO(sample))
        rows = list(reader)
        return {
            "rows": len(rows),
            "columns": reader.fieldnames or [],
            "preview": rows[:5],
        }
    except csv.Error:
        return {"rows": 0, "columns": [], "preview": []}


def sample_artifacts(parse_artifact) -> list[Artifact]:
    files = [
        "jira_export.csv",
        "meeting_notes.txt",
        "build_log.txt",
        "email_thread.txt",
    ]
    artifacts: list[Artifact] = []
    for file_name in files:
        path = SAMPLE_DATA_DIR / file_name
        if not path.exists():
            continue
        artifacts.append(
            parse_artifact(
                Artifact(name=file_name, type=artifact_type_for(file_name), content=read_text_file(path)),
                source="sample",
            )
        )
    return artifacts
