import React from "react";
import { AlertTriangle, Bot, FileText, Gauge, Play, ShieldCheck, Wand2 } from "lucide-react";
import { ActionsView } from "./components/ActionsView";
import { AgentPipeline, AgentRunLoader } from "./components/AgentPipeline";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { BrandLogo } from "./components/BrandLogo";
import { CodexView } from "./components/CodexView";
import { DraftsView } from "./components/DraftsView";
import { EvidenceView } from "./components/EvidenceView";
import { HealthSparkline } from "./components/HealthSparkline";
import { RiskView } from "./components/RiskView";
import { Signal } from "./components/Signal";
import { useAnalysis } from "./hooks/useAnalysis";
import { classNames, formatConfidence } from "./utils/formatting";

export default function App() {
  const {
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
  } = useAnalysis();

  return (
    <div className="app">
      <header className="hero">
        <nav className="nav">
          <div className="brand">
            <BrandLogo />
            <div>
              <span>DeliverIQ</span>
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
        <ArtifactPanel
          analysisComplete={analysisComplete}
          dataSource={dataSource}
          files={files}
          handleDrop={handleDrop}
          handleUpload={handleUpload}
          loadedFileSize={loadedFileSize}
          roiMetrics={roiMetrics}
        />

        <section className="dashboard">
          <section className="summary-strip">
            <div>
              <p className="eyebrow">Executive Summary</p>
              <h2>{analysis.projectName}</h2>
              <p>{analysis.executiveSummary}</p>
            </div>
          </section>

          <AgentPipeline
            agents={analysis.agents}
            loading={loading}
            pipelineActiveStep={pipelineActiveStep}
            pipelineDoneCount={pipelineDoneCount}
          />

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
          {activeTab === "drafts" && <DraftsView drafts={analysis.drafts} risks={analysis.risks} artifacts={files} dataSource={dataSource} />}
        </section>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} DeliverIQ.</span>
        <span>
          Powered by{" "}
          <a href="https://gulashan.vercel.app/" target="_blank" rel="noreferrer">
            Gulshan
          </a>
        </span>
      </footer>
    </div>
  );
}
