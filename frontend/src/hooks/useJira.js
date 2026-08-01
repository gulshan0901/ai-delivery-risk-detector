import { API_BASE } from "../constants/config";

export async function loadLiveJira() {
  const response = await fetch(`${API_BASE}/api/jira/summary`);
  const payload = await response.json();
  if (!payload.connected || !payload.artifacts?.length) return null;
  return payload.artifacts;
}

export async function postToJira(issueKey, comment) {
  const response = await fetch(`${API_BASE}/api/jira/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_key: issueKey, comment })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(payload.detail || "Could not post Jira comment");
  }
  return payload;
}
