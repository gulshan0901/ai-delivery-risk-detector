export const sampleArtifacts = [
  {
    name: "jira_export.csv",
    type: "Jira CSV",
    content: `Project: Phoenix Delivery Program
Key,Summary,Status,Owner,Priority,AgeDays,Dependency,Notes
PAY-231,Payment API contract finalization,Blocked,TBD,Critical,8,Client Integration Team,Waiting for final schema; client concern raised
AUTH-184,SSO callback validation,In Progress,Meera,High,4,Identity Platform,QA found intermittent callback timeout
REL-092,Release readiness checklist,Open,Unassigned,High,6,Build Pipeline,Blocked until CI is green
QA-448,Regression pack execution,Open,Arun,Medium,3,Payment API,Test execution delayed by environment failure
UX-117,Dashboard copy updates,Done,Nisha,Low,1,None,Ready for release`
  },
  {
    name: "meeting_notes.txt",
    type: "Meeting Notes",
    content: `Daily delivery sync
Project: Phoenix Delivery Program

The payment API dependency is still blocked after 8 days. No confirmed owner from the client integration team.
QA cannot complete regression because the latest build failed during install.
Client partner asked whether the release date is at risk. PM will need a crisp escalation note today.
Action proposed: create a 24-hour recovery plan and assign named owners for each blocker.
Engineering lead requested Codex assistance to inspect the failing build log and generate a patch plan.`
  },
  {
    name: "build_log.txt",
    type: "Build Log",
    content: `CI job: phoenix-web-release
Runtime: Node 20

npm ci
ERR dependency resolution failed
Error: Cannot find module '@hcltech/payment-contract/v3'
at loadContract (src/integration/paymentClient.js:42:11)

Test suite aborted before QA validation.
Build status: failed
Recommended: verify lockfile, package registry access, and payment client import path.`
  }
];
