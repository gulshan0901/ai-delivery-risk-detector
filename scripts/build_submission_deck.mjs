import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "file:///C:/Users/gulsh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "submission");
const PPTX_PATH = path.join(OUT_DIR, "Agentic_Delivery_Risk_Copilot_Submission.pptx");
const PREVIEW_DIR = path.join(OUT_DIR, "deck-preview");
const SCREENSHOT =
  "C:/Users/gulsh/AppData/Local/Temp/codex-clipboard-3ed41e64-7daf-46f6-bf18-c89b7178fb39.png";

const W = 1280;
const H = 720;
const colors = {
  navy: "#09213f",
  deep: "#0f2f4a",
  blue: "#1d5fd6",
  teal: "#008b8f",
  green: "#218a4b",
  red: "#c9323c",
  ink: "#101522",
  muted: "#617084",
  line: "#dbe4ef",
  wash: "#f4f7fb",
  white: "#ffffff"
};

function addText(slide, text, x, y, w, h, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 }
  });
  shape.text = text;
  shape.text.style = {
    fontSize: style.fontSize ?? 24,
    bold: style.bold ?? false,
    color: style.color ?? colors.ink,
    alignment: style.alignment ?? "left"
  };
  return shape;
}

function addBox(slide, x, y, w, h, fill = colors.white, line = colors.line) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: "rounded-xl",
    shadow: "shadow-sm"
  });
}

function addHeader(slide, title, eyebrow = "AGENTIC DELIVERY RISK COPILOT") {
  addText(slide, eyebrow, 72, 44, 560, 26, {
    fontSize: 14,
    bold: true,
    color: colors.teal
  });
  addText(slide, title, 72, 78, 900, 54, {
    fontSize: 40,
    bold: true,
    color: colors.ink
  });
}

function addFooter(slide, n) {
  addText(slide, "HCLTech x OpenAI Agentic AI Hackathon", 72, 668, 520, 24, {
    fontSize: 13,
    color: colors.muted
  });
  addText(slide, String(n), 1170, 668, 40, 24, {
    fontSize: 13,
    color: colors.muted,
    alignment: "right"
  });
}

async function addScreenshot(slide, x, y, w, h) {
  try {
    const bytes = await fs.readFile(SCREENSHOT);
    slide.images.add({
      blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      contentType: "image/png",
      alt: "Agentic Delivery Risk Copilot dashboard screenshot",
      fit: "contain",
      position: { left: x, top: y, width: w, height: h },
      geometry: "roundRect",
      borderRadius: "rounded-xl"
    });
  } catch {
    addBox(slide, x, y, w, h, "#eaf2fb", colors.line);
    addText(slide, "Live dashboard screenshot", x + 34, y + 120, w - 68, 70, {
      fontSize: 32,
      bold: true,
      color: colors.deep,
      alignment: "center"
    });
  }
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  const deck = Presentation.create({ slideSize: { width: W, height: H } });

  // 1. Title
  {
    const slide = deck.slides.add();
    slide.background.fill = colors.navy;
    addText(slide, "HCLTech x OpenAI", 72, 54, 520, 34, {
      fontSize: 22,
      bold: true,
      color: colors.white
    });
    addText(slide, "Agentic Delivery\nRisk Copilot", 72, 145, 760, 158, {
      fontSize: 58,
      bold: true,
      color: colors.white
    });
    addText(
      slide,
      "A multi-agent command center that detects project risk, proves it with evidence, drafts recovery actions, and creates Codex-ready remediation guidance.",
      76,
      340,
      700,
      118,
      { fontSize: 24, color: "#d6e6f7" }
    );
    addBox(slide, 845, 120, 300, 360, "#123d5a", "#4e7892");
    addText(slide, "OpenAI API", 900, 168, 200, 36, { fontSize: 28, bold: true, color: colors.white, alignment: "center" });
    addText(slide, "5 agents", 900, 260, 200, 54, { fontSize: 46, bold: true, color: colors.white, alignment: "center" });
    addText(slide, "Evidence-backed\nrecovery planning", 882, 370, 240, 80, { fontSize: 22, bold: true, color: "#d6e6f7", alignment: "center" });
    addFooter(slide, 1);
  }

  // 2. Problem
  {
    const slide = deck.slides.add();
    slide.background.fill = colors.wash;
    addHeader(slide, "The Enterprise Delivery Problem");
    const items = [
      ["Status is fragmented", "Risks are spread across Jira exports, meeting notes, build logs, and emails."],
      ["Blockers are found late", "Manual reviews miss stale ownership, dependency aging, and technical failure patterns."],
      ["Recovery takes too long", "PMs still need to draft escalation notes, Jira updates, and executive summaries manually."]
    ];
    items.forEach(([title, body], i) => {
      const y = 178 + i * 132;
      addBox(slide, 96, y, 1040, 96);
      addText(slide, title, 130, y + 18, 310, 32, { fontSize: 26, bold: true, color: colors.ink });
      addText(slide, body, 475, y + 19, 600, 48, { fontSize: 22, color: colors.muted });
    });
    addFooter(slide, 2);
  }

  // 3. Solution
  {
    const slide = deck.slides.add();
    slide.background.fill = colors.white;
    addHeader(slide, "Solution: Multi-Agent Delivery Command Center");
    addText(
      slide,
      "The copilot converts raw project artifacts into a prioritized recovery plan with source evidence and ready-to-approve communications.",
      72,
      146,
      1000,
      58,
      { fontSize: 24, color: colors.muted }
    );
    const cards = [
      ["Detect", "Find blocked work, stale owners, failed builds, and client escalation signals."],
      ["Prove", "Cite exact artifact, row, and line evidence behind each risk."],
      ["Recover", "Generate escalation emails, Jira comments, and Codex remediation prompts."]
    ];
    cards.forEach(([title, body], i) => {
      const x = 78 + i * 390;
      addBox(slide, x, 254, 338, 230, i === 1 ? "#eefafa" : "#f8fafc", i === 1 ? "#9bd8d9" : colors.line);
      addText(slide, title, x + 28, 290, 260, 44, { fontSize: 34, bold: true, color: i === 1 ? colors.teal : colors.ink });
      addText(slide, body, x + 28, 356, 270, 88, { fontSize: 21, color: colors.muted });
    });
    addFooter(slide, 3);
  }

  // 4. OpenAI usage
  {
    const slide = deck.slides.add();
    slide.background.fill = colors.wash;
    addHeader(slide, "OpenAI Products Used");
    const rows = [
      ["OpenAI Responses API", "Reasoning over project artifacts and generating structured outputs for the dashboard."],
      ["Structured JSON", "Risk score, evidence, severity, actions, drafts, and remediation plan are returned as strict fields."],
      ["Tool-style orchestration", "The app presents the workflow as ingestion, evidence, risk, action, and remediation agents."],
      ["Codex workflow", "The remediation agent produces a Codex-ready prompt for build/code fixes and regression tests."]
    ];
    rows.forEach(([title, body], i) => {
      const x = i % 2 === 0 ? 88 : 668;
      const y = i < 2 ? 176 : 378;
      addBox(slide, x, y, 500, 150);
      addText(slide, title, x + 28, y + 24, 430, 34, { fontSize: 26, bold: true, color: colors.blue });
      addText(slide, body, x + 28, y + 70, 420, 58, { fontSize: 20, color: colors.muted });
    });
    addFooter(slide, 4);
  }

  // 5. Architecture
  {
    const slide = deck.slides.add();
    slide.background.fill = colors.white;
    addHeader(slide, "Architecture");
    const steps = ["Artifacts", "Ingestion", "Evidence", "Risk", "Actions", "Codex"];
    steps.forEach((step, i) => {
      const x = 70 + i * 195;
      addBox(slide, x, 238, 145, 110, i === 0 ? "#eaf2ff" : "#eefaf2", i === 0 ? "#a9c8f7" : "#b9dfc9");
      addText(slide, step, x + 12, 278, 121, 34, { fontSize: 22, bold: true, color: colors.ink, alignment: "center" });
      if (i < steps.length - 1) {
        addText(slide, "→", x + 150, 276, 40, 36, { fontSize: 34, bold: true, color: colors.muted, alignment: "center" });
      }
    });
    addText(slide, "React frontend", 152, 440, 250, 36, { fontSize: 26, bold: true, color: colors.blue, alignment: "center" });
    addText(slide, "FastAPI backend", 515, 440, 250, 36, { fontSize: 26, bold: true, color: colors.teal, alignment: "center" });
    addText(slide, "OpenAI API", 878, 440, 250, 36, { fontSize: 26, bold: true, color: colors.green, alignment: "center" });
    addFooter(slide, 5);
  }

  // 6. Demo
  {
    const slide = deck.slides.add();
    slide.background.fill = colors.wash;
    addHeader(slide, "Live Demo Flow");
    await addScreenshot(slide, 610, 150, 560, 315);
    const points = [
      "Load Jira export, meeting notes, and build log.",
      "Run the agent workflow.",
      "Show risk score, evidence, actions, drafts, and Codex remediation.",
      "Explain measurable business impact."
    ];
    points.forEach((point, i) => {
      addText(slide, `${i + 1}.`, 96, 170 + i * 80, 50, 34, { fontSize: 28, bold: true, color: colors.blue });
      addText(slide, point, 150, 170 + i * 80, 390, 42, { fontSize: 24, color: colors.ink });
    });
    addFooter(slide, 6);
  }

  // 7. Impact
  {
    const slide = deck.slides.add();
    slide.background.fill = colors.navy;
    addText(slide, "Why This Can Win", 72, 68, 720, 58, { fontSize: 44, bold: true, color: colors.white });
    const stats = [
      ["3 hrs → 15 min", "Status prep"],
      ["Same day", "Blocker detection"],
      ["5 agents", "Repeatable workflow"],
      ["Ready", "Scale across teams"]
    ];
    stats.forEach(([value, label], i) => {
      const x = 78 + (i % 2) * 560;
      const y = 178 + Math.floor(i / 2) * 170;
      addBox(slide, x, y, 480, 118, "#123d5a", "#4e7892");
      addText(slide, value, x + 28, y + 24, 350, 42, { fontSize: 34, bold: true, color: colors.white });
      addText(slide, label, x + 28, y + 76, 350, 28, { fontSize: 20, color: "#d6e6f7" });
    });
    addText(
      slide,
      "Submission close: an OpenAI-first enterprise product with clear innovation, measurable impact, real-world relevance, technical execution, and scalability.",
      90,
      560,
      1030,
      64,
      { fontSize: 24, bold: true, color: "#d6e6f7", alignment: "center" }
    );
    addFooter(slide, 7);
  }

  for (const [index, slide] of deck.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(PREVIEW_DIR, `${stem}.png`), await deck.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(PREVIEW_DIR, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(path.join(PREVIEW_DIR, "montage.webp"), await deck.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(PPTX_PATH);
  console.log(PPTX_PATH);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
