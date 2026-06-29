import React from "react";
import { Empty } from "./Empty";

export function EvidenceView({ risks = [] }) {
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
