import { useEffect, useMemo, useState } from "react";
import { AGENT_STEPS } from "../constants/agents";
import { API_BASE } from "../constants/config";
import { sampleArtifacts } from "../sampleArtifacts";
import { readBrowserFiles, withSourceBadge } from "../utils/artifacts";
import { compactMetric } from "../utils/formatting";
import { parseSseMessages } from "../utils/sse";
import { loadLiveJira } from "./useJira";

export const emptyAnalysis = {
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

export function useAnalysis() {
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

    async function hydrateLiveJira() {
      try {
        const artifacts = await loadLiveJira();
        if (cancelled || !artifacts?.length) return;

        setFiles(current => {
          if (current.length) return current;
          setDataSource("live");
          return artifacts;
        });
      } catch {
        // Silent fallback: upload zone and sample data remain available.
      }
    }

    hydrateLiveJira();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return {
    activeTab,
    analysis,
    analysisComplete,
    analyzeProject,
    apiMode,
    dataSource,
    error,
    files,
    handleDrop,
    handleUpload,
    loading,
    loadedFileSize,
    loadSamples,
    pipelineActiveStep,
    pipelineDoneCount,
    roiMetrics,
    setActiveTab,
    topRisk
  };
}
