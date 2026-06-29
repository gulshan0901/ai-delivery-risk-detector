import React from "react";
import { CheckCircle2, Wand2 } from "lucide-react";
import { AGENT_STEPS, agentIcons, fallbackAgentIcon } from "../constants/agents";
import { classNames } from "../utils/formatting";

export function AgentRunLoader({ activeIndex, doneCount }) {
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

export function AgentPipeline({ agents = [], loading, pipelineActiveStep, pipelineDoneCount }) {
  return (
    <section className="pipeline-bar" aria-label="Live agent pipeline">
      <div className="pipeline-title">
        <strong>Live agent heartbeat</strong>
        <span>{loading ? "Running sequence" : pipelineDoneCount === AGENT_STEPS.length ? "Workflow complete" : "Ready"}</span>
      </div>
      <div className="pipeline-track">
        {AGENT_STEPS.map((name, index) => {
          const Icon = agentIcons[name] || fallbackAgentIcon;
          const running = pipelineActiveStep === index;
          const completed =
            !running &&
            (pipelineDoneCount > index || (!loading && pipelineDoneCount === 0 && agents.some(agent => agent.name === name)));
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
  );
}
