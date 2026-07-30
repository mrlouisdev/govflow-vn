import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDossier, answerScope } from "../src/engine.mjs";

const complete = {
  requestTitle: "Hồ sơ thử nghiệm A",
  requestType: "Tiếp nhận thử nghiệm",
  applicantReference: "DEMO-001",
  submissionDate: "2026-07-31",
  signed: true,
  attachments: ["application_form", "supporting_document"]
};

test("complete dossier is ready", () => {
  const result = analyzeDossier(complete);
  assert.equal(result.status, "ready");
  assert.equal(result.findings.length, 0);
});

test("incomplete dossier produces cited findings", () => {
  const result = analyzeDossier({ requestTitle: "Mẫu B", applicantReference: "BAD", attachments: [] });
  assert.equal(result.status, "needs_review");
  assert.ok(result.findings.length >= 5);
  assert.ok(result.findings.every((item) => item.citation));
});

test("out-of-scope question is refused", () => {
  const result = answerScope("Dự báo thời tiết ngày mai");
  assert.equal(result.supported, false);
  assert.match(result.message, /Ngoài phạm vi/);
});

