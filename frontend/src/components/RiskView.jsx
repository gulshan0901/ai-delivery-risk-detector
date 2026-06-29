import React from "react";
import { Empty } from "./Empty";
import { confidenceLevel } from "../utils/formatting";

export function RiskView({ risks = [] }) {
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
