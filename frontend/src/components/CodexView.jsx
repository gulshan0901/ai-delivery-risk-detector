import React from "react";
import { Bot, Code2, GitBranch } from "lucide-react";

export function CodexView({ codex }) {
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
