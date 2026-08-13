import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDossier, answerScope, demoRuleset } from "../src/engine.mjs";

const complete = {
  requestTitle: "Hồ sơ thử nghiệm A",
  requestType: "Tiếp nhận thử nghiệm",
  applicantReference: "DEMO-001",
  submissionDate: "2026-07-31",
  signed: true,
  attachments: ["application_form", "supporting_document"]
};

function dossier(overrides = {}) {
  return { ...complete, ...overrides };
}

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

test("a blank required value is treated as missing", () => {
  const result = analyzeDossier(dossier({ requestTitle: " \t " }));
  assert.equal(result.status, "needs_review");
  assert.deepEqual(
    result.findings.map((finding) => `${finding.code}:${finding.field}`),
    ["MISSING_FIELD:requestTitle"]
  );
});

test("a non-array attachment value is safely treated as no attachments", () => {
  const result = analyzeDossier(dossier({ attachments: "application_form" }));
  assert.deepEqual(
    result.findings.map((finding) => finding.field),
    ["application_form", "supporting_document"]
  );
});

test("invalid reference is a blocking, cited error", () => {
  const result = analyzeDossier(dossier({ applicantReference: "DEMO-12" }));
  const finding = result.findings.find((item) => item.code === "INVALID_REFERENCE");
  assert.equal(result.status, "needs_review");
  assert.equal(finding?.citation, "GOVFLOW-DEMO-001 §3.1");
});

test("invalid date is a warning and does not block an otherwise complete dossier", () => {
  const result = analyzeDossier(dossier({ submissionDate: "31-07-2026" }));
  assert.equal(result.status, "ready");
  assert.deepEqual(result.findings.map((finding) => finding.code), ["INVALID_DATE"]);
});

test("calendar-impossible dates are warned but remain nonblocking", () => {
  for (const submissionDate of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10"]) {
    const result = analyzeDossier(dossier({ submissionDate }));
    assert.equal(result.status, "ready");
    assert.deepEqual(result.findings.map((finding) => finding.code), ["INVALID_DATE"]);
  }
  assert.equal(analyzeDossier(dossier({ submissionDate: "2024-02-29" })).findings.length, 0);
});

test("null and non-object dossiers are safely treated as empty", () => {
  for (const input of [null, undefined, "bad", 42, []]) {
    const result = analyzeDossier(input);
    assert.equal(result.status, "needs_review");
    assert.equal(result.findings.filter((finding) => finding.code === "MISSING_FIELD").length, 4);
    assert.equal(result.findings.filter((finding) => finding.code === "MISSING_ATTACHMENT").length, 2);
  }
});

test("unsigned warning does not block an otherwise complete dossier", () => {
  const result = analyzeDossier(dossier({ signed: false }));
  assert.equal(result.status, "ready");
  assert.deepEqual(result.findings.map((finding) => finding.code), ["UNSIGNED"]);
});

test("all required omissions map to the ruleset citations", () => {
  const result = analyzeDossier({ signed: true, attachments: [] });
  const expected = new Map(
    [...demoRuleset.requiredFields, ...demoRuleset.requiredAttachments].map((rule) => [rule.key, rule.citation])
  );
  const missing = result.findings.filter((finding) => finding.code.startsWith("MISSING_"));
  assert.equal(missing.length, expected.size);
  for (const finding of missing) assert.equal(finding.citation, expected.get(finding.field));
});

test("audit metadata records the engine, timestamp, and checked rule count", () => {
  const result = analyzeDossier(complete);
  assert.equal(result.audit.engine, "govflow-deterministic-mvp/0.2.0");
  assert.equal(result.audit.checkedRules, 9);
  assert.ok(Number.isFinite(Date.parse(result.audit.evaluatedAt)));
});

test("custom rulesets expose their identity and rule count", () => {
  const ruleset = {
    id: "SYNTHETIC-CUSTOM-001",
    title: "Custom synthetic rule",
    notice: "Test only",
    requiredFields: [{ key: "requestTitle", label: "Tên", citation: "SYNTHETIC-CUSTOM-001 §1" }],
    requiredAttachments: []
  };
  const result = analyzeDossier({ requestTitle: "Mẫu", signed: true }, ruleset);
  assert.equal(result.ruleset.id, ruleset.id);
  assert.equal(result.audit.checkedRules, 1);
  assert.equal(result.status, "ready");
});

test("custom rulesets do not leak demo-specific validators or citations", () => {
  const ruleset = {
    id: "SYNTHETIC-CUSTOM-002",
    title: "Custom isolation rule",
    notice: "Test only",
    requiredFields: [{ key: "requestTitle", label: "Tên", citation: "SYNTHETIC-CUSTOM-002 §1" }],
    requiredAttachments: []
  };
  const result = analyzeDossier({
    requestTitle: "Mẫu",
    applicantReference: "BAD",
    submissionDate: "31-07-2026",
    signed: false
  }, ruleset);

  assert.equal(result.status, "ready");
  assert.equal(result.audit.checkedRules, 1);
  assert.deepEqual(result.findings, []);
  assert.ok(result.findings.every((finding) => !finding.citation?.startsWith("GOVFLOW-DEMO-001")));
});

test("supported scope terms are accepted case-insensitively", () => {
  const result = answerScope("CHO TÔI XEM TRÍCH DẪN");
  assert.equal(result.supported, true);
  assert.match(result.message, /phạm vi ruleset demo/);
});

test("closely related dossier language is accepted", () => {
  for (const question of ["Có tệp đính kèm nào?", "Ngày tiếp nhận là lúc nào?", "Đơn đã ký chưa?"]) {
    assert.equal(answerScope(question).supported, true);
  }
});

test("scope matching does not accept substrings inside unrelated words", () => {
  assert.equal(answerScope("Bài toán này đơn giản không? ").supported, false);
  assert.equal(answerScope("Tôi đang tham chiếu hóa dữ liệu").supported, false);
});

test("out-of-scope question is refused", () => {
  const result = answerScope("Dự báo thời tiết ngày mai");
  assert.equal(result.supported, false);
  assert.match(result.message, /Ngoài phạm vi/);
});

test("empty questions are refused instead of guessed", () => {
  const result = answerScope("   ");
  assert.equal(result.supported, false);
  assert.match(result.message, /không suy đoán/);
});
