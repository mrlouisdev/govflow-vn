export const demoRuleset = {
  id: "GOVFLOW-DEMO-001",
  title: "Synthetic dossier intake rules",
  notice: "Synthetic rules for prototype verification; not an official procedure.",
  requiredFields: [
    { key: "requestTitle", label: "Tên yêu cầu", citation: "GOVFLOW-DEMO-001 §1.1" },
    { key: "requestType", label: "Loại hồ sơ", citation: "GOVFLOW-DEMO-001 §1.2" },
    { key: "applicantReference", label: "Mã tham chiếu", citation: "GOVFLOW-DEMO-001 §1.3" },
    { key: "submissionDate", label: "Ngày tiếp nhận", citation: "GOVFLOW-DEMO-001 §1.4" }
  ],
  requiredAttachments: [
    { key: "application_form", label: "Đơn đề nghị", citation: "GOVFLOW-DEMO-001 §2.1" },
    { key: "supporting_document", label: "Tài liệu hỗ trợ", citation: "GOVFLOW-DEMO-001 §2.2" }
  ],
  validators: [
    {
      check(input) {
        return hasValue(input.applicantReference) && !/^DEMO-\d{3}$/.test(String(input.applicantReference))
          ? { severity: "error", code: "INVALID_REFERENCE", field: "applicantReference", message: "Mã tham chiếu demo phải có dạng DEMO-000.", citation: "GOVFLOW-DEMO-001 §3.1" }
          : null;
      }
    },
    {
      check(input) {
        return hasValue(input.submissionDate) && !isCalendarDate(String(input.submissionDate))
          ? { severity: "warning", code: "INVALID_DATE", field: "submissionDate", message: "Ngày tiếp nhận phải có dạng YYYY-MM-DD.", citation: "GOVFLOW-DEMO-001 §3.2" }
          : null;
      }
    },
    {
      check(input) {
        return input.signed !== true
          ? { severity: "warning", code: "UNSIGNED", field: "signed", message: "Đơn chưa được xác nhận đã ký.", citation: "GOVFLOW-DEMO-001 §4.1" }
          : null;
      }
    }
  ]
};

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function analyzeDossier(dossier, ruleset = demoRuleset) {
  const input = dossier !== null && typeof dossier === "object" && !Array.isArray(dossier) ? dossier : {};
  const findings = [];
  const attachments = new Set(Array.isArray(input.attachments) ? input.attachments : []);
  const validators = Array.isArray(ruleset.validators) ? ruleset.validators : [];

  for (const rule of ruleset.requiredFields) {
    if (!hasValue(input[rule.key])) {
      findings.push({ severity: "error", code: "MISSING_FIELD", field: rule.key, message: `Thiếu ${rule.label}.`, citation: rule.citation });
    }
  }

  for (const rule of ruleset.requiredAttachments) {
    if (!attachments.has(rule.key)) {
      findings.push({ severity: "error", code: "MISSING_ATTACHMENT", field: rule.key, message: `Thiếu ${rule.label}.`, citation: rule.citation });
    }
  }

  for (const validator of validators) {
    const finding = validator.check(input);
    if (finding) findings.push(finding);
  }

  const errors = findings.filter((item) => item.severity === "error").length;
  return {
    ruleset: { id: ruleset.id, title: ruleset.title, notice: ruleset.notice },
    status: errors === 0 ? "ready" : "needs_review",
    summary: errors === 0 ? "Hồ sơ mẫu đủ điều kiện chuyển bước kiểm tra tiếp theo." : `Hồ sơ mẫu có ${errors} lỗi cần xử lý.`,
    findings,
    audit: {
      evaluatedAt: new Date().toISOString(),
      engine: "govflow-deterministic-mvp/0.2.0",
      checkedRules: ruleset.requiredFields.length + ruleset.requiredAttachments.length + validators.length
    }
  };
}

function isCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const supportedPatterns = [
  /(?:^|[^\p{L}\p{N}_])hồ sơ(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])giấy tờ(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])tài liệu(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])đơn (?:đề nghị|đã|chưa|có|còn)(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])trích dẫn(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])căn cứ(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])mã tham chiếu(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])đính kèm(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])ngày tiếp nhận(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])(?:đã ký|chưa ký|chữ ký)(?:$|[^\p{L}\p{N}_])/u,
  /(?:^|[^\p{L}\p{N}_])ruleset(?:$|[^\p{L}\p{N}_])/u
];

export function answerScope(question) {
  const normalized = String(question ?? "").normalize("NFC").toLocaleLowerCase("vi-VN").replace(/\s+/g, " ").trim();
  const supported = normalized !== "" && supportedPatterns.some((pattern) => pattern.test(normalized));
  return supported
    ? { supported: true, message: "Câu hỏi nằm trong phạm vi ruleset demo. Hãy chạy kiểm tra để xem kết quả có trích dẫn." }
    : { supported: false, message: "Ngoài phạm vi dữ liệu demo. GovFlow không suy đoán câu trả lời khi thiếu nguồn kiểm chứng." };
}

