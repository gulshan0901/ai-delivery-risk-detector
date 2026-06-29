def agent_summaries(artifact_count: int) -> list[dict[str, str]]:
    return [
        {"name": "Ingestion Agent", "status": "Complete", "summary": f"Parsed {artifact_count} project artifacts."},
        {"name": "Evidence Agent", "status": "Complete", "summary": "Extracted blockers, failed builds, stale work, and ownership gaps."},
        {"name": "Risk Analysis Agent", "status": "Complete", "summary": "Calculated risk score and severity-ranked delivery threats."},
        {"name": "Action Planning Agent", "status": "Complete", "summary": "Generated escalation, Jira update, and recovery plan drafts."},
        {"name": "Codex Remediation Agent", "status": "Complete", "summary": "Analyzed build failure signals and proposed technical remediation."},
    ]


def recommended_actions() -> list[str]:
    return [
        "Create a recovery war-room for the integration blocker with PM, engineering lead, and dependency owner.",
        "Update Jira with owner, due date, blocker reason, and next checkpoint for every high-risk item.",
        "Run build remediation on the failing module and attach the root-cause summary to the release ticket.",
        "Send client-safe status note with risk, impact, recovery action, and next update time.",
    ]


def recovery_drafts() -> dict[str, str]:
    return {
        "executiveStatus": (
            "Current delivery health is At Risk. The main driver is an unresolved integration dependency "
            "combined with a failing build that blocks QA validation. Recovery plan: assign dependency owner "
            "today, restore build pipeline, and provide a checkpoint update within 24 hours."
        ),
        "escalationEmail": (
            "Subject: Action Required: Delivery Risk on Integration Dependency\n\n"
            "Hi Team,\n\n"
            "The delivery copilot has identified a high-risk integration blocker with downstream impact on QA "
            "and sprint commitments. Please assign a dependency owner today, confirm the next fix window, and "
            "join a 24-hour recovery checkpoint.\n\n"
            "Recommended next actions:\n"
            "1. Confirm owner and ETA for the blocked integration.\n"
            "2. Restore the failing build and attach root cause to the release ticket.\n"
            "3. Update Jira with blocker reason, due date, and next checkpoint.\n\n"
            "Regards,\nDelivery Risk Copilot"
        ),
        "jiraComment": (
            "AI risk review: This item appears blocked and may impact release readiness. Please update owner, "
            "dependency, expected resolution date, and next validation step. Suggested severity: High."
        ),
    }
