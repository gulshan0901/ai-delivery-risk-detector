const STORAGE_KEY = "deliveriq_api_key";

export function getApiKey({ promptIfMissing = false } = {}) {
  let key = sessionStorage.getItem(STORAGE_KEY) || "";
  if (!key && promptIfMissing) {
    key = window.prompt("Enter the DelverIQ API access key")?.trim() || "";
    if (key) sessionStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}

export function apiHeaders({ promptIfMissing = false, json = false } = {}) {
  const key = getApiKey({ promptIfMissing });
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(key ? { "X-API-Key": key } : {})
  };
}

export function clearApiKey() {
  sessionStorage.removeItem(STORAGE_KEY);
}
