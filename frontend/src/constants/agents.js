import { Bot, Code2, FileText, Gauge, GitBranch, Layers3 } from "lucide-react";

export const agentIcons = {
  "Ingestion Agent": Layers3,
  "Evidence Agent": FileText,
  "Risk Analysis Agent": Gauge,
  "Action Planning Agent": GitBranch,
  "Codex Remediation Agent": Code2
};

export const AGENT_STEPS = [
  "Ingestion Agent",
  "Evidence Agent",
  "Risk Analysis Agent",
  "Action Planning Agent",
  "Codex Remediation Agent"
];

export const fallbackAgentIcon = Bot;
