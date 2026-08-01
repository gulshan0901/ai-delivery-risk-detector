import { API_BASE } from "../constants/config";
import { apiHeaders, clearApiKey } from "../utils/api";

export async function loadLiveJira() {
  const response = await fetch(`${API_BASE}/api/jira/summary`, {
    headers: apiHeaders()
  });
  const payload = await response.json();
  if (!payload.connected || !payload.artifacts?.length) return null;
  return payload.artifacts;
}

export async function postToJira(issueKey, comment) {
  const response = await fetch(`${API_BASE}/api/jira/comment`, {
    method: "POST",
    headers: apiHeaders({ promptIfMissing: true, json: true }),
    body: JSON.stringify({ issue_key: issueKey, comment })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    if (response.status === 401) clearApiKey();
    throw new Error(payload.detail || "Could not post Jira comment");
  }
  return payload;
}
