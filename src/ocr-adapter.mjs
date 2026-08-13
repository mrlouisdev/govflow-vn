export const OCR_ADAPTER_ID = "govflow-ocr-contract/0.2.0";
export const OCR_CONTRACT_VERSION = "1.0.0";

const supportedFields = new Map([
  ["requestTitle", "string"],
  ["requestType", "string"],
  ["applicantReference", "string"],
  ["submissionDate", "string"],
  ["signed", "boolean"],
  ["attachments", "string-array"]
]);

const envelopeProperties = new Set(["contractVersion", "documentId", "synthetic", "fields"]);
const fieldRecordProperties = new Set(["value", "confidence", "sources"]);
const sourceProperties = new Set(["page", "blockId", "locator"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyProperties(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizedDocumentId(input) {
  return typeof input?.documentId === "string" && input.documentId.trim().length > 0
    ? input.documentId.trim()
    : null;
}

function failure(code, message, field = null) {
  return { code, field, message };
}

function hasSupportedValue(value, type) {
  if (type === "string") return typeof value === "string" && value.trim().length > 0;
  if (type === "boolean") return typeof value === "boolean";
  if (type === "string-array") {
    return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
  }
  return false;
}

function normalizeValue(value, type) {
  if (type === "string") return value.trim();
  if (type === "string-array") return [...new Set(value.map((item) => item.trim()))];
  return value;
}

function normalizeSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const normalized = [];
  for (const source of sources) {
    if (!isRecord(source) || !hasOnlyProperties(source, sourceProperties)) return null;
    if (!Number.isInteger(source.page) || source.page < 1) return null;
    if (typeof source.blockId !== "string" || source.blockId.trim().length === 0) return null;
    if ("locator" in source && (typeof source.locator !== "string" || source.locator.trim().length === 0)) return null;
    normalized.push({
      page: source.page,
      blockId: source.blockId.trim(),
      ...(typeof source.locator === "string" && source.locator.trim()
        ? { locator: source.locator.trim() }
        : {})
    });
  }
  return normalized;
}

export function adaptOcrExtraction(input, { minimumConfidence = 0.75 } = {}) {
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new RangeError("minimumConfidence must be between 0 and 1");
  }

  const baseAudit = {
    adapter: OCR_ADAPTER_ID,
    contractVersion: OCR_CONTRACT_VERSION,
    minimumConfidence
  };

  if (!isRecord(input)) {
    return {
      status: "invalid",
      dossier: null,
      provenance: {},
      failures: [failure("INVALID_INPUT", "OCR extraction must be an object.")],
      audit: { ...baseAudit, documentId: null, extractedFields: 0, rejectedFields: 0 }
    };
  }

  if (input.contractVersion !== OCR_CONTRACT_VERSION) {
    return {
      status: "invalid",
      dossier: null,
      provenance: {},
      failures: [failure("UNSUPPORTED_CONTRACT_VERSION", `Expected OCR contract ${OCR_CONTRACT_VERSION}.`)],
      audit: { ...baseAudit, documentId: normalizedDocumentId(input), extractedFields: 0, rejectedFields: 0 }
    };
  }

  if (
    !hasOnlyProperties(input, envelopeProperties) ||
    typeof input.documentId !== "string" ||
    input.documentId.trim().length === 0 ||
    ("synthetic" in input && typeof input.synthetic !== "boolean") ||
    !isRecord(input.fields)
  ) {
    return {
      status: "invalid",
      dossier: null,
      provenance: {},
      failures: [failure("INVALID_ENVELOPE", "documentId and fields are required.")],
      audit: { ...baseAudit, documentId: null, extractedFields: 0, rejectedFields: 0 }
    };
  }

  const dossier = {};
  const provenance = {};
  const failures = [];

  for (const [field, record] of Object.entries(input.fields)) {
    const type = supportedFields.get(field);
    if (!type) {
      failures.push(failure("UNSUPPORTED_FIELD", `Unsupported OCR field: ${field}.`, field));
      continue;
    }
    if (
      !isRecord(record) ||
      !hasOnlyProperties(record, fieldRecordProperties) ||
      !Number.isFinite(record.confidence) ||
      record.confidence < 0 ||
      record.confidence > 1
    ) {
      failures.push(failure("MALFORMED_FIELD", `Field ${field} requires a confidence between 0 and 1.`, field));
      continue;
    }
    if (!hasSupportedValue(record.value, type)) {
      failures.push(failure("MISSING_TEXT", `Field ${field} has no usable extracted value.`, field));
      continue;
    }

    const sources = normalizeSources(record.sources);
    if (!sources) {
      failures.push(failure("MISSING_PROVENANCE", `Field ${field} requires at least one valid source locator.`, field));
      continue;
    }
    if (record.confidence < minimumConfidence) {
      failures.push(failure("LOW_CONFIDENCE", `Field ${field} is below the ${minimumConfidence} confidence threshold.`, field));
      continue;
    }

    dossier[field] = normalizeValue(record.value, type);
    provenance[field] = { confidence: record.confidence, sources };
  }

  return {
    status: failures.length === 0 ? "ready" : "needs_review",
    dossier,
    provenance,
    failures,
    audit: {
      ...baseAudit,
      documentId: input.documentId.trim(),
      extractedFields: Object.keys(dossier).length,
      rejectedFields: failures.length
    }
  };
}
