import React from "react";
import { Empty } from "./Empty";

export function ActionsView({ actions = [], impact }) {
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
