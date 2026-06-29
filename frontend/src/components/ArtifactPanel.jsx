import React from "react";
import { FileText, Upload } from "lucide-react";
import { classNames } from "../utils/formatting";

export function ArtifactPanel({
  analysisComplete,
  dataSource,
  files,
  handleDrop,
  handleUpload,
  loadedFileSize,
  roiMetrics
}) {
  return (
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
  );
}
