export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function formatConfidence(value) {
  if (value === undefined || value === null || value === "--") return "--";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
}

export function compactMetric(label, value, fallbackValue, fallbackDetail = "") {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return { value: fallbackValue, detail: fallbackDetail };
  const lower = text.toLowerCase();

  if (label === "Manual prep") {
    const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|hour|hr)/i);
    return {
      value: hours ? `${hours[1]} hrs` : fallbackValue,
      detail: text.length > 18 ? text : ""
    };
  }

  if (label === "Copilot prep") {
    const minutes = text.match(/under\s*(\d+)\s*(?:minutes|mins|min)/i) || text.match(/(\d+)\s*(?:minutes|mins|min)/i);
    return {
      value: minutes ? `<${minutes[1]} min` : fallbackValue,
      detail: text.length > 18 ? text : ""
    };
  }

  if (label === "Detection") {
    if (lower.includes("automatic")) return { value: "Automatic", detail: text.length > 18 ? text : "" };
    if (lower.includes("same day")) return { value: "Same day", detail: text.length > 18 ? text : "" };
    return { value: text.length > 16 ? fallbackValue : text, detail: text.length > 16 ? text : "" };
  }

  return { value: text, detail: fallbackDetail };
}

export function confidenceLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return { percent: 0, level: "low", label: "--" };
  const percent = Math.max(0, Math.min(100, numeric > 0 && numeric <= 1 ? numeric * 100 : numeric));
  const level = percent > 80 ? "high" : percent > 60 ? "medium" : "low";
  return { percent, level, label: `${Math.round(percent)}%` };
}
