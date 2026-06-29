import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Code2,
  FileText,
  Gauge,
  GitBranch,
  Layers3,
  Mail,
  Play,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { sampleArtifacts } from "./sampleArtifacts";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MAX_UPLOAD_CHARS = Number(import.meta.env.VITE_MAX_UPLOAD_CHARS || 180000);

const emptyAnalysis = {
  projectName: "Project Risk Analysis",
  executiveSummary:
    "Load the sample artifacts or upload delivery data to run the OpenAI-powered agent workflow.",
  health: {
    score: "--",
    label: "Ready",
    trend: "Waiting",
    confidence: "--",
    timeSavedHours: "--"
  },
  agents: [],
  risks: [],
  recommendedActions: [],
  drafts: {},
  codexRemediation: {
    suspectedRootCause: "No build issue analyzed yet.",
    fixPlan: [],
    patchPrompt: "Run analysis to generate a Codex remediation prompt."
  },
  measurement: {
    manualStatusPrep: "--",
    copilotStatusPrep: "--",
    blockerDetection: "--",
    expectedImpact: "Evidence-backed delivery recovery planning."
  }
};

const agentIcons = {
  "Ingestion Agent": Layers3,
  "Evidence Agent": FileText,
  "Risk Analysis Agent": Gauge,
  "Action Planning Agent": GitBranch,
  "Codex Remediation Agent": Code2
};

const AGENT_STEPS = [
  "Ingestion Agent",
  "Evidence Agent",
  "Risk Analysis Agent",
  "Action Planning Agent",
  "Codex Remediation Agent"
];

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function formatConfidence(value) {
  if (value === undefined || value === null || value === "--") return "--";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
}

function compactMetric(label, value, fallbackValue, fallbackDetail = "") {
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

function prepareArtifactContent(content) {
  if (content.length <= MAX_UPLOAD_CHARS) {
    return { content, truncated: false, originalLength: content.length };
  }

  const headLength = Math.floor(MAX_UPLOAD_CHARS * 0.78);
  const tailLength = Math.floor(MAX_UPLOAD_CHARS * 0.12);
  const head = content.slice(0, headLength);
  const tail = content.slice(-tailLength);
  const omitted = content.length - head.length - tail.length;
  return {
    content: `${head}\n\n[... ${omitted} characters omitted from large upload preview ...]\n\n${tail}`,
    truncated: true,
    originalLength: content.length
  };
}

function withSourceBadge(artifacts, source) {
  const badge = source === "sample" ? "Sample" : source === "live" ? "Live" : "Uploaded";
  return artifacts.map(artifact => ({ ...artifact, source, badge: artifact.badge || badge }));
}

function parseSseMessages(buffer) {
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() || "";
  const messages = blocks
    .map(block =>
      block
        .split("\n")
        .filter(line => line.startsWith("data:"))
        .map(line => line.replace(/^data:\s?/, ""))
        .join("\n")
    )
    .filter(Boolean)
    .map(message => JSON.parse(message));

  return { messages, remainder };
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [dataSource, setDataSource] = useState("empty");
  const [analysis, setAnalysis] = useState(emptyAnalysis);
  const [activeTab, setActiveTab] = useState("risks");
  const [loading, setLoading] = useState(false);
  const [apiMode, setApiMode] = useState("FastAPI");
  const [error, setError] = useState("");
  const [pipelineActiveStep, setPipelineActiveStep] = useState(-1);
  const [pipelineDoneCount, setPipelineDoneCount] = useState(0);

  const topRisk = useMemo(() => analysis.risks?.[0], [analysis]);
  const analysisComplete = Boolean(analysis.generatedAt);
  const roiMetrics = useMemo(() => {
    const manualPrep = compactMetric("Manual prep", analysis.measurement.manualStatusPrep, "3 hrs");
    const copilotPrep = compactMetric("Copilot prep", analysis.measurement.copilotStatusPrep, "<5 min");
    const detection = compactMetric("Detection", analysis.measurement.blockerDetection, "Same day");
    const timeSaved = analysisComplete
      ? { value: "12 hrs", detail: "Estimated PM time saved / week" }
      : { value: "-- hrs", detail: "Estimated PM time saved / week" };

    return { manualPrep, copilotPrep, timeSaved, detection };
  }, [analysis, analysisComplete]);
  const loadedFileSize = useMemo(
    () => files.reduce((total, file) => total + file.content.length, 0),
    [files]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLiveJira() {
      try {
        const response = await fetch(`${API_BASE}/api/jira/summary`);
        const payload = await response.json();
        if (cancelled || !payload.connected || !payload.artifacts?.length) return;

        setFiles(current => {
          if (current.length) return current;
          setDataSource("live");
          return payload.artifacts;
        });
      } catch {
        // Silent fallback: upload zone and sample data remain available.
      }
    }

    loadLiveJira();
    return () => {
      cancelled = true;
    };
  }, []);

  async function readBrowserFiles(fileList) {
    const selectedFiles = Array.from(fileList || []);
    const loaded = await Promise.all(
      selectedFiles.map(async file => {
        const prepared = prepareArtifactContent(await file.text());
        return {
          name: file.name,
          type: file.type || "Uploaded artifact",
          content: prepared.content,
          truncated: prepared.truncated,
          originalLength: prepared.originalLength
        };
      })
    );
    return loaded;
  }

  async function processUploadedFiles(fileList) {
    const loaded = await readBrowserFiles(fileList);
    if (!loaded.length) return;

    try {
      // Let FastAPI normalize CSV/JSON/text metadata so uploaded and sample data share one shape.
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: loaded })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Upload parsing failed");
      setFiles(payload.artifacts || withSourceBadge(loaded, "upload"));
    } catch {
      setFiles(withSourceBadge(loaded, "upload"));
    }
    setDataSource("upload");
    setError("");
  }

  async function handleUpload(event) {
    await processUploadedFiles(event.target.files);
    event.target.value = "";
  }

  async function handleDrop(event) {
    event.preventDefault();
    await processUploadedFiles(event.dataTransfer.files);
  }

  async function loadSamples() {
    try {
      const response = await fetch(`${API_BASE}/api/sample-data`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Sample data failed");
      setFiles(payload.artifacts || withSourceBadge(sampleArtifacts, "sample"));
    } catch {
      setFiles(withSourceBadge(sampleArtifacts, "sample"));
    }
    setDataSource("sample");
    setError("");
  }

  async function ensureArtifactsForRun() {
    if (files.length > 0) return { artifacts: files, source: dataSource === "empty" ? "upload" : dataSource };

    // Guaranteed demo path: if no live/uploaded artifacts exist, run with backend sample data.
    try {
      const response = await fetch(`${API_BASE}/api/sample-data`);
      const payload = await response.json();
      if (!response.ok) throw new Error("Sample data failed");
      const artifacts = payload.artifacts || withSourceBadge(sampleArtifacts, "sample");
      setFiles(artifacts);
      setDataSource("sample");
      return { artifacts, source: "sample" };
    } catch {
      const artifacts = withSourceBadge(sampleArtifacts, "sample");
      setFiles(artifacts);
      setDataSource("sample");
      return { artifacts, source: "sample" };
    }
  }

  async function analyzeProject() {
    if (loading) return;
    // Flip the UI into a running state before any fetch so the click always feels responsive.
    setLoading(true);
    setError("");
    setPipelineActiveStep(0);
    setPipelineDoneCount(0);

    try {
      const { artifacts, source } = await ensureArtifactsForRun();
      const response = await fetch(`${API_BASE}/api/analyze/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, artifacts })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Streaming analysis failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // SSE messages can arrive split across chunks; keep the remainder until the next read.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseMessages(buffer);
        buffer = parsed.remainder;

        for (const message of parsed.messages) {
          if (message.type === "agent_started") {
            setPipelineActiveStep(message.index);
          }

          if (message.type === "agent_completed") {
            setPipelineDoneCount(current => Math.max(current, message.index + 1));
            setPipelineActiveStep(current => (current === message.index ? -1 : current));
          }

          if (message.type === "analysis") {
            const payload = message.analysis;
            setAnalysis(payload);
            setApiMode(payload.mode === "openai-api" ? "OpenAI API Active" : "FastAPI Demo");
          }

          if (message.type === "pipeline_completed") {
            setPipelineDoneCount(AGENT_STEPS.length);
            setPipelineActiveStep(-1);
          }

          if (message.type === "error") {
            throw new Error(message.detail || "Analysis failed");
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setPipelineActiveStep(-1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <nav className="nav">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={20} />
            </div>
            <div>
              <span>HCLTech x OpenAI</span>
              <strong>Agentic AI Hackathon</strong>
            </div>
          </div>
          <div className="nav-status">
            <ShieldCheck size={17} />
            {apiMode}
          </div>
        </nav>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Multi-agent delivery command center</p>
            <h1>Detect delivery risk. Prove it. Recover faster.</h1>
            <p>
              OpenAI-powered agents analyze project artifacts, cite evidence, draft recovery actions,
              and create Codex-ready remediation guidance for technical blockers.
            </p>
            <div className="hero-kpis">
              <span>OpenAI API</span>
              <span>5-agent workflow</span>
              <span>Evidence-first recovery</span>
            </div>
            <div className="hero-actions">
              <button className={classNames("primary", loading && "working")} onClick={analyzeProject} disabled={loading}>
                {loading ? <Wand2 size={18} /> : <Play size={18} />}
                {loading ? "Agents analyzing" : "Run agent workflow"}
              </button>
              <button className="secondary" onClick={loadSamples}>
                <FileText size={18} />
                Load sample artifacts
              </button>
            </div>
            {loading && <AgentRunLoader activeIndex={pipelineActiveStep} doneCount={pipelineDoneCount} />}
            {error && <div className="error-banner">{error}</div>}
          </div>

          <div className="hero-panel">
            <div className="risk-orbit">
              <div className="health-score-row">
                <div className="health-score-main">
                  <span>Delivery Health</span>
                  <strong>{analysis.health.score}</strong>
                  <small>{analysis.health.label}</small>
                </div>
                <HealthSparkline currentScore={analysis.health.score} />
              </div>
            </div>
            <div className="signal-list">
              <Signal icon={AlertTriangle} label="Top Risk" value={topRisk?.title || "Waiting for analysis"} />
              <Signal icon={Gauge} label="Confidence" value={formatConfidence(analysis.health.confidence)} />
              <Signal icon={Bot} label="Agents" value="5 specialized agents" />
            </div>
          </div>
        </section>
      </header>

      <main className="workspace">
        <aside className="artifact-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Inputs</span>
              <h2>Project Artifacts</h2>
            </div>
            <span className="file-count">{files.length || 0} files</span>
          </div>

          <section className="roi-grid" aria-label="Business impact">
            <div className="roi-card">
              <span>Manual prep</span>
              <strong>{roiMetrics.manualPrep.value}</strong>
              {roiMetrics.manualPrep.detail && <small>{roiMetrics.manualPrep.detail}</small>}
            </div>
            <div className="roi-card">
              <span>Copilot prep</span>
              <strong>{roiMetrics.copilotPrep.value}</strong>
              {roiMetrics.copilotPrep.detail && <small>{roiMetrics.copilotPrep.detail}</small>}
            </div>
            <div className={classNames("roi-card", "time-saved-card", analysisComplete && "revealed")}>
              <span>Time saved</span>
              <strong>{roiMetrics.timeSaved.value}</strong>
              <small>{roiMetrics.timeSaved.detail}</small>
            </div>
            <div className="roi-card">
              <span>Detection</span>
              <strong>{roiMetrics.detection.value}</strong>
              {roiMetrics.detection.detail && <small>{roiMetrics.detection.detail}</small>}
            </div>
          </section>

          {dataSource === "live" && (
            <div className="live-source-note">
              <span className="live-dot" />
              Jira connected automatically. Add files to enrich the analysis.
            </div>
          )}

          <label
            className="upload-card"
            onDragOver={event => event.preventDefault()}
            onDrop={handleDrop}
          >
            <Upload size={28} />
            <strong>Upload Jira CSV, notes, logs, reports</strong>
            <span>TXT, CSV, LOG, MD, JSON</span>
            <input type="file" multiple accept=".txt,.csv,.log,.md,.json" onChange={handleUpload} />
          </label>

          <div className="artifact-meta">
            <div>
              <span>Total text</span>
              <strong>{Math.max(1, Math.ceil(loadedFileSize / 1024))} KB</strong>
            </div>
            <div>
              <span>Backend</span>
              <strong>FastAPI</strong>
            </div>
          </div>

          <div className="file-stack">
            {files.map(file => (
              <div className="file-row" key={file.name}>
                <FileText size={18} />
                <div>
                  <div className="file-row-title">
                    <strong>{file.name}</strong>
                    <span className={classNames("source-badge", file.source === "live" && "live")}>
                      {file.badge || (file.source === "sample" ? "Sample" : file.source === "live" ? "Live" : "Uploaded")}
                      {file.source === "live" && <i />}
                    </span>
                  </div>
                  <span>
                    {file.truncated
                      ? "Large file optimized for analysis"
                      : file.meta?.ticketCount
                        ? `${file.meta.ticketCount} tickets fetched`
                        : file.type || "Artifact"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="dashboard">
          <section className="summary-strip">
            <div>
              <p className="eyebrow">Executive Summary</p>
              <h2>{analysis.projectName}</h2>
              <p>{analysis.executiveSummary}</p>
            </div>
          </section>

          <section className="pipeline-bar" aria-label="Live agent pipeline">
            <div className="pipeline-title">
              <strong>Live agent heartbeat</strong>
              <span>{loading ? "Running sequence" : pipelineDoneCount === AGENT_STEPS.length ? "Workflow complete" : "Ready"}</span>
            </div>
            <div className="pipeline-track">
              {AGENT_STEPS.map((name, index) => {
                const Icon = agentIcons[name] || Bot;
                const completed = pipelineDoneCount > index || analysis.agents.some(agent => agent.name === name);
                const running = pipelineActiveStep === index;
                const waiting = !completed && !running;

                return (
                  <React.Fragment key={name}>
                    {index > 0 && (
                      <div
                        className={classNames(
                          "pipeline-connector",
                          pipelineDoneCount >= index && "complete",
                          pipelineActiveStep === index && "running"
                        )}
                      />
                    )}
                    <div
                      className={classNames(
                        "pipeline-node",
                        completed && "complete",
                        running && "running",
                        waiting && "waiting"
                      )}
                    >
                      <Icon size={18} />
                      <span>{name.replace(" Agent", "")}</span>
                      {completed && <CheckCircle2 size={16} />}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          <div className="tabs">
            {["risks", "evidence", "actions", "codex", "drafts"].map(tab => (
              <button
                key={tab}
                className={classNames("tab", activeTab === tab && "active")}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "risks" && <RiskView risks={analysis.risks} />}
          {activeTab === "evidence" && <EvidenceView risks={analysis.risks} />}
          {activeTab === "actions" && <ActionsView actions={analysis.recommendedActions} impact={analysis.measurement.expectedImpact} />}
          {activeTab === "codex" && <CodexView codex={analysis.codexRemediation} />}
          {activeTab === "drafts" && <DraftsView drafts={analysis.drafts} risks={analysis.risks} artifacts={files} />}
        </section>
      </main>
    </div>
  );
}

function Signal({ icon: Icon, label, value }) {
  return (
    <div className="signal">
      <Icon size={19} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function HealthSparkline({ currentScore }) {
  const current = Number.isFinite(Number(currentScore)) ? Number(currentScore) : 55;
  const scores = [82, 74, 63, current];

  return (
    <div className="health-sparkline" aria-label="Four sprint health score trend">
      <div className="sparkline-label">
        <span>4-sprint trend</span>
        <strong>{scores.join(" -> ")}</strong>
      </div>
      <svg viewBox="0 0 168 62" role="img" aria-hidden="true">
        <polyline points="8,12 58,22 108,36 158,48" />
        {[
          [8, 12],
          [58, 22],
          [108, 36],
          [158, 48]
        ].map(([x, y], index) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={index === 3 ? 5 : 4} />
        ))}
      </svg>
      <div className="sparkline-sprints">
        <span>S-3</span>
        <span>S-2</span>
        <span>S-1</span>
        <span>Now</span>
      </div>
    </div>
  );
}

function AgentRunLoader({ activeIndex, doneCount }) {
  const currentIndex = activeIndex >= 0 ? activeIndex : Math.min(doneCount, AGENT_STEPS.length - 1);
  const currentStep = AGENT_STEPS[currentIndex] || AGENT_STEPS[0];
  // Give the active step partial progress so the bar moves before the first agent completes.
  const progress = Math.min(100, Math.max(8, Math.round(((doneCount + (activeIndex >= 0 ? 0.45 : 0)) / AGENT_STEPS.length) * 100)));

  return (
    <div className="agent-loader" role="status" aria-live="polite">
      <div className="loader-header">
        <div className="loader-mark">
          <Wand2 size={18} />
        </div>
        <div>
          <strong>Agent workflow running</strong>
          <span>{currentStep.replace(" Agent", "")} in progress</span>
        </div>
      </div>
      <div className="loader-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="loader-steps">
        {AGENT_STEPS.map((step, index) => (
          <i
            key={step}
            className={classNames(index < doneCount && "done", index === activeIndex && "active")}
            title={step}
          />
        ))}
      </div>
    </div>
  );
}

function confidenceLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return { percent: 0, level: "low", label: "--" };
  const percent = Math.max(0, Math.min(100, numeric > 0 && numeric <= 1 ? numeric * 100 : numeric));
  const level = percent > 80 ? "high" : percent > 60 ? "medium" : "low";
  return { percent, level, label: `${Math.round(percent)}%` };
}

function RiskView({ risks = [] }) {
  if (!risks.length) return <Empty title="No risks yet" text="Run the workflow to rank delivery threats." />;
  return (
    <section className="content-grid">
      {risks.map(risk => {
        const confidence = confidenceLevel(risk.confidence);

        return (
          <article className="risk-card" key={risk.title}>
            <div className="risk-head">
              <div>
                <h3>{risk.title}</h3>
                <p>Owner: {risk.owner}</p>
              </div>
              <span className={`severity ${risk.severity}`}>{risk.severity}</span>
            </div>
            <div className={`confidence-bar ${confidence.level}`}>
              <div className="confidence-meta">
                <span>AI Confidence</span>
                <strong>{confidence.label}</strong>
              </div>
              <div className="confidence-track">
                <span style={{ width: `${confidence.percent}%` }} />
              </div>
            </div>
            <p>{risk.businessImpact}</p>
            <div className="recommendation">{risk.recommendedAction}</div>
          </article>
        );
      })}
    </section>
  );
}

function EvidenceView({ risks = [] }) {
  const evidence = risks.flatMap(risk => (risk.evidence || []).map(item => ({ ...item, risk: risk.title })));
  if (!evidence.length) return <Empty title="No evidence yet" text="The Evidence Agent will cite source rows and lines here." />;
  return (
    <section className="timeline">
      {evidence.map((item, index) => (
        <article className="evidence-item" key={`${item.source}-${item.line}-${index}`}>
          <span>{item.source}:{item.line}</span>
          <strong>{item.risk}</strong>
          <p>{item.quote}</p>
        </article>
      ))}
    </section>
  );
}

function ActionsView({ actions = [], impact }) {
  if (!actions.length) return <Empty title="No actions yet" text="The Action Planning Agent will generate recovery steps." />;
  return (
    <section className="content-grid">
      {actions.map((action, index) => (
        <article className="action-card" key={action}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <p>{action}</p>
        </article>
      ))}
      <article className="impact-card">
        <strong>Measured Business Impact</strong>
        <p>{impact}</p>
      </article>
    </section>
  );
}

function CodexView({ codex }) {
  return (
    <section className="codex-grid">
      <article className="codex-card">
        <Code2 size={22} />
        <h3>Suspected Root Cause</h3>
        <p>{codex.suspectedRootCause}</p>
      </article>
      <article className="codex-card">
        <GitBranch size={22} />
        <h3>Fix Plan</h3>
        <ul>
          {(codex.fixPlan || []).map(step => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </article>
      <article className="codex-card wide">
        <Bot size={22} />
        <h3>Codex Patch Prompt</h3>
        <p>{codex.patchPrompt}</p>
      </article>
    </section>
  );
}

function parseEmailDraft(email = "") {
  const lines = String(email).split(/\r?\n/);
  const subjectLine = lines.find(line => line.toLowerCase().startsWith("subject:"));
  const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "") : "Delivery risk recovery update";
  const body = lines.filter(line => !line.toLowerCase().startsWith("subject:")).join("\n").trim();
  return {
    to: "Project stakeholders",
    subject,
    body: body || email
  };
}

function inferJiraIssueKey(risk, fallbackText = "") {
  const haystack = [
    risk?.issueKey,
    risk?.key,
    risk?.title,
    risk?.recommendedAction,
    fallbackText,
    ...(risk?.evidence || []).flatMap(item => [item.source, item.quote])
  ]
    .filter(Boolean)
    .join(" ");
  const match = haystack.match(/\b[A-Z][A-Z0-9]+-\d+\b/);
  return match?.[0] || "";
}

function extractLiveJiraKeys(artifacts = []) {
  const liveArtifact = artifacts.find(artifact => artifact.source === "live" && artifact.content);
  if (!liveArtifact) return [];

  try {
    const payload = JSON.parse(liveArtifact.content);
    return (payload.issues || []).map(issue => issue.key || issue.id).filter(Boolean);
  } catch {
    const matches = liveArtifact.content.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];
    return [...new Set(matches)];
  }
}

function DraftsView({ drafts = {}, risks = [], artifacts = [] }) {
  const [postingKey, setPostingKey] = useState("");
  const [postedComments, setPostedComments] = useState({});
  const [postError, setPostError] = useState("");

  if (!drafts.executiveStatus) return <Empty title="No drafts yet" text="Drafts appear after the action agent completes." />;
  const email = parseEmailDraft(drafts.escalationEmail);
  const jiraCards = risks.length
    ? risks
    : [
        {
          title: "Delivery risk follow-up",
          severity: "High",
          owner: "Project Manager",
          recommendedAction: drafts.jiraComment
        }
      ];
  const liveJiraKeys = extractLiveJiraKeys(artifacts);

  async function postToJira(issueKey, comment) {
    if (!issueKey || !comment || postingKey) return;
    setPostingKey(issueKey);
    setPostError("");

    try {
      const response = await fetch(`${API_BASE}/api/jira/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue_key: issueKey, comment })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.detail || "Could not post Jira comment");
      setPostedComments(current => ({ ...current, [issueKey]: payload.comment_id || "posted" }));
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPostingKey("");
    }
  }

  return (
    <section className="draft-grid">
      <article className="email-artifact">
        <div className="artifact-header">
          <div>
            <Mail size={20} />
            <h3>Escalation Email</h3>
          </div>
          <span>Ready for approval</span>
        </div>
        <div className="email-fields">
          <div>
            <span>To</span>
            <strong>{email.to}</strong>
          </div>
          <div>
            <span>Subject</span>
            <strong>{email.subject}</strong>
          </div>
        </div>
        <div className="email-body">
          <div className="email-body-title">
            <FileText size={18} />
            <strong>Body</strong>
          </div>
          <pre>{email.body}</pre>
        </div>
      </article>

      <article className="executive-artifact">
        <div className="artifact-header">
          <div>
            <FileText size={20} />
            <h3>Executive Status Brief</h3>
          </div>
          <span>Summary</span>
        </div>
        <p>{drafts.executiveStatus}</p>
      </article>

      <section className="jira-artifacts" aria-label="Jira update cards">
        {postError && <div className="jira-post-error">{postError}</div>}
        {jiraCards.map((risk, index) => {
          const comment = risk.recommendedAction || drafts.jiraComment;
          const issueKey = inferJiraIssueKey(risk, comment) || liveJiraKeys[index] || "";
          const displayKey = issueKey || `RISK-${String(index + 1).padStart(3, "0")}`;
          const posted = Boolean(issueKey && postedComments[issueKey]);
          const posting = postingKey === issueKey;

          return (
            <article className="jira-card" key={`${risk.title}-${index}`}>
              <div className="jira-topline">
                <div>
                  <span className="jira-key">{displayKey}</span>
                  <h3>{risk.title}</h3>
                </div>
                <span className={`priority-badge ${risk.severity}`}>{risk.severity || "High"}</span>
              </div>
              <div className="jira-meta">
                <span>Owner</span>
                <strong>{risk.owner || "Project Manager"}</strong>
              </div>
              <div className="jira-comment">
                <span>Comment</span>
                <p>{comment}</p>
              </div>
              <button
                className={classNames("jira-post-button", posting && "posting", posted && "posted")}
                disabled={!issueKey || posting || posted}
                onClick={() => postToJira(issueKey, comment)}
                title={issueKey ? `Post comment to ${issueKey}` : "Run live Jira analysis to detect an issue key"}
              >
                {posted ? <CheckCircle2 size={17} /> : posting ? <Wand2 size={17} /> : <GitBranch size={17} />}
                {posted ? "Posted to Jira" : posting ? "Posting..." : issueKey ? "Post to Jira" : "No Jira key"}
              </button>
            </article>
          );
        })}
      </section>
    </section>
  );
}

function Draft({ icon: Icon, title, text }) {
  return (
    <article className="draft-card">
      <div>
        <Icon size={20} />
        <h3>{title}</h3>
      </div>
      <pre>{text}</pre>
    </article>
  );
}

function Empty({ title, text }) {
  return (
    <div className="empty">
      <Sparkles size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
