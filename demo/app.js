import { analyzeDossier, answerScope } from "../src/engine.mjs";

const complete = {
  requestTitle: "Hồ sơ thử nghiệm A",
  requestType: "Tiếp nhận thử nghiệm",
  applicantReference: "DEMO-001",
  submissionDate: "2026-07-31",
  signed: true,
  attachments: ["application_form", "supporting_document"]
};

const incomplete = {
  requestTitle: "Hồ sơ thử nghiệm B",
  requestType: "Tiếp nhận thử nghiệm",
  applicantReference: "BAD",
  submissionDate: "31-07-2026",
  signed: false,
  attachments: ["application_form"]
};

const dossier = document.querySelector("#dossier");
const summary = document.querySelector("#summary");
const findings = document.querySelector("#findings");
const audit = document.querySelector("#audit");

function load(value) {
  dossier.value = JSON.stringify(value, null, 2);
}

function render(result) {
  summary.className = `summary ${result.status}`;
  summary.textContent = result.summary;
  findings.innerHTML = result.findings.length
    ? result.findings.map((item) => `<article class="finding ${item.severity}"><strong>${item.code}</strong><p>${item.message}</p><code>${item.citation}</code></article>`).join("")
    : '<article class="finding success"><strong>PASS</strong><p>Không phát hiện lỗi trong ruleset demo.</p></article>';
  audit.textContent = JSON.stringify(result.audit, null, 2);
}

document.querySelector("#load-complete").addEventListener("click", () => load(complete));
document.querySelector("#load-incomplete").addEventListener("click", () => load(incomplete));
document.querySelector("#analyze").addEventListener("click", () => {
  try {
    render(analyzeDossier(JSON.parse(dossier.value)));
  } catch (error) {
    summary.className = "summary needs_review";
    summary.textContent = `JSON không hợp lệ: ${error.message}`;
  }
});
document.querySelector("#ask").addEventListener("click", () => {
  document.querySelector("#scope-answer").textContent = answerScope(document.querySelector("#question").value).message;
});

load(incomplete);

