import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def jira_base_url() -> str | None:
    domain = os.getenv("JIRA_DOMAIN")
    base_url = os.getenv("JIRA_BASE_URL")
    # Accept either the short Atlassian domain or a full base URL for easier local setup.
    if domain:
        return f"https://{domain.strip().removeprefix('https://').rstrip('/')}/rest/api/3"
    if base_url:
        return f"{base_url.rstrip('/')}/rest/api/3"
    return None


def jira_auth_header() -> str | None:
    bearer = os.getenv("JIRA_BEARER_TOKEN")
    if bearer:
        return f"Bearer {bearer}"

    email = os.getenv("JIRA_EMAIL")
    token = os.getenv("JIRA_API_TOKEN")
    if not email or not token:
        return None

    encoded = base64.b64encode(f"{email}:{token}".encode("utf-8")).decode("ascii")
    return f"Basic {encoded}"


def jira_request(path: str, method: str = "GET", params: dict[str, Any] | None = None, body: dict[str, Any] | None = None) -> dict[str, Any]:
    base = jira_base_url()
    auth = jira_auth_header()
    if not base or not auth:
        raise RuntimeError("Jira credentials are not configured.")

    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        f"{base}{path}{query}",
        data=data,
        headers={
            "Authorization": auth,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Jira API error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Jira connection failed: {exc.reason}") from exc


def issue_to_summary(issue: dict[str, Any]) -> dict[str, Any]:
    fields = issue.get("fields", {})
    priority = fields.get("priority") or {}
    status = fields.get("status") or {}
    assignee = fields.get("assignee") or {}

    return {
        "id": issue.get("key"),
        "key": issue.get("key"),
        "title": fields.get("summary"),
        "summary": fields.get("summary"),
        "status": status.get("name"),
        "assignee": assignee.get("displayName") or "Unassigned",
        "priority": priority.get("name") or "Unprioritized",
        "updated": fields.get("updated"),
        "due_date": fields.get("duedate"),
        "duedate": fields.get("duedate"),
        "labels": fields.get("labels") or [],
    }


def get_issues(max_results: int | None = None) -> list[dict[str, Any]]:
    project = os.getenv("JIRA_PROJECT_KEY")
    jql = os.getenv("JIRA_JQL") or (f"project = {project} ORDER BY priority ASC, updated DESC" if project else "ORDER BY updated DESC")
    # Atlassian removed the old /search endpoint; enhanced JQL search is the supported path.
    payload = jira_request(
        "/search/jql",
        params={
            "jql": jql,
            "maxResults": max_results or int(os.getenv("JIRA_MAX_RESULTS", "20")),
            "fields": "summary,status,assignee,priority,updated,duedate,labels,comment",
        },
    )
    return [issue_to_summary(issue) for issue in payload.get("issues", [])]


def post_comment(issue_key: str, comment: str) -> dict[str, Any]:
    return jira_request(
        f"/issue/{urllib.parse.quote(issue_key)}/comment",
        method="POST",
        body={
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": comment}],
                    }
                ],
            }
        },
    )
