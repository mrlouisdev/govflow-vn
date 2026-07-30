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
  ]
};

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function analyzeDossier(dossier, ruleset = demoRuleset) {
  const findings = [];
  const attachments = new Set(Array.isArray(dossier.attachments) ? dossier.attachments : []);

  for (const rule of ruleset.requiredFields) {
    if (!hasValue(dossier[rule.key])) {
      findings.push({ severity: "error", code: "MISSING_FIELD", field: rule.key, message: `Thiếu ${rule.label}.`, citation: rule.citation });
    }
  }

  if (hasValue(dossier.applicantReference) && !/^DEMO-\d{3}$/.test(String(dossier.applicantReference))) {
    findings.push({ severity: "error", code: "INVALID_REFERENCE", field: "applicantReference", message: "Mã tham chiếu demo phải có dạng DEMO-000.", citation: "GOVFLOW-DEMO-001 §3.1" });
  }

  if (hasValue(dossier.submissionDate) && !/^\d{4}-\d{2}-\d{2}$/.test(String(dossier.submissionDate))) {
    findings.push({ severity: "warning", code: "INVALID_DATE", field: "submissionDate", message: "Ngày tiếp nhận phải có dạng YYYY-MM-DD.", citation: "GOVFLOW-DEMO-001 §3.2" });
  }

  for (const rule of ruleset.requiredAttachments) {
    if (!attachments.has(rule.key)) {
      findings.push({ severity: "error", code: "MISSING_ATTACHMENT", field: rule.key, message: `Thiếu ${rule.label}.`, citation: rule.citation });
    }
  }

  if (dossier.signed !== true) {
    findings.push({ severity: "warning", code: "UNSIGNED", field: "signed", message: "Đơn chưa được xác nhận đã ký.", citation: "GOVFLOW-DEMO-001 §4.1" });
  }

  const errors = findings.filter((item) => item.severity === "error").length;
  return {
    ruleset: { id: ruleset.id, title: ruleset.title, notice: ruleset.notice },
    status: errors === 0 ? "ready" : "needs_review",
    summary: errors === 0 ? "Hồ sơ mẫu đủ điều kiện chuyển bước kiểm tra tiếp theo." : `Hồ sơ mẫu có ${errors} lỗi cần xử lý.`,
    findings,
    audit: {
      evaluatedAt: new Date().toISOString(),
      engine: "govflow-deterministic-mvp/0.1.0",
      checkedRules: ruleset.requiredFields.length + ruleset.requiredAttachments.length + 3
    }
  };
}

const supportedTerms = ["hồ sơ", "giấy tờ", "thiếu", "đơn", "trạng thái", "căn cứ", "trích dẫn", "tài liệu", "tham chiếu"];

export function answerScope(question) {
  const normalized = String(question || "").toLocaleLowerCase("vi-VN");
  const supported = supportedTerms.some((term) => normalized.includes(term));
  return supported
    ? { supported: true, message: "Câu hỏi nằm trong phạm vi ruleset demo. Hãy chạy kiểm tra để xem kết quả có trích dẫn." }
    : { supported: false, message: "Ngoài phạm vi dữ liệu demo. GovFlow không suy đoán câu trả lời khi thiếu nguồn kiểm chứng." };
}

