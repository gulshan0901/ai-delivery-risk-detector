import React, { useState } from "react";
import { CheckCircle2, FileText, GitBranch, Mail, Wand2 } from "lucide-react";
import { postToJira } from "../hooks/useJira";
import { classNames } from "../utils/formatting";
import { Empty } from "./Empty";

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

export function DraftsView({ drafts = {}, risks = [], artifacts = [], dataSource = "empty" }) {
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
  const canPostToJira = dataSource === "live" && liveJiraKeys.length > 0;

  async function handlePostToJira(issueKey, comment) {
    if (!canPostToJira || !issueKey || !comment || postingKey) return;
    setPostingKey(issueKey);
    setPostError("");

    try {
      const payload = await postToJira(issueKey, comment);
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
          const posted = Boolean(canPostToJira && issueKey && postedComments[issueKey]);
          const posting = Boolean(canPostToJira && issueKey && postingKey === issueKey);
          const disabled = !canPostToJira || !issueKey || posting || posted;

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
                disabled={disabled}
                onClick={() => handlePostToJira(issueKey, comment)}
                title={canPostToJira && issueKey ? `Post comment to ${issueKey}` : "Posting is enabled only for live Jira data"}
              >
                {posted ? <CheckCircle2 size={17} /> : posting ? <Wand2 size={17} /> : <GitBranch size={17} />}
                {posted ? "Posted to Jira" : posting ? "Posting..." : canPostToJira && issueKey ? "Post to Jira" : "Live Jira only"}
              </button>
            </article>
          );
        })}
      </section>
    </section>
  );
}
