from typing import Any

from models.schemas import Artifact


def build_context(artifacts: list[Artifact], source: str = "upload") -> str:
    source_note = {
        "live": "Source layer: Live Jira API. Treat tickets as current enterprise delivery data.",
        "upload": "Source layer: Uploaded project artifacts. Treat files as user-provided delivery evidence.",
        "sample": "Source layer: Sample data. Use it as the guaranteed demo dataset.",
    }.get(source, f"Source layer: {source}.")
    jira_context = ""

    if source == "live":
        # Live Jira needs stronger prioritization hints than generic uploaded documents.
        jira_context = (
            "Live Jira analysis rules: prioritize tickets with status Blocked, priority Critical/High, "
            "overdue due_date, Unassigned assignee, and labels such as ci-blocker, client-dependency, "
            "at-risk, escalation, scope-creep, overdue, or technical-debt. Use Jira keys in risk titles "
            "or evidence where helpful, and recommend concrete owner/date/action updates."
        )

    lines = [
        source_note,
        "Normalize all inputs into one project view. Cite source names and line numbers where possible.",
        "Prefer measurable business impact and specific recovery ownership.",
    ]
    if jira_context:
        lines.append(jira_context)
    return "\n".join(lines)


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
