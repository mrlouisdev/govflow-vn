import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeDossier } from "../src/engine.mjs";
import { adaptOcrExtraction, OCR_ADAPTER_ID, OCR_CONTRACT_VERSION } from "../src/ocr-adapter.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../examples/ocr/${name}.json`, import.meta.url), "utf8"));
}

test("complete synthetic OCR extraction produces a cited, analyzable dossier", async () => {
  const result = adaptOcrExtraction(await fixture("complete"));
  assert.equal(result.status, "ready");
  assert.equal(result.audit.adapter, OCR_ADAPTER_ID);
  assert.equal(result.audit.contractVersion, OCR_CONTRACT_VERSION);
  assert.equal(result.audit.extractedFields, 6);
  assert.deepEqual(Object.keys(result.provenance).sort(), Object.keys(result.dossier).sort());
  assert.ok(Object.values(result.provenance).every((item) => item.sources.length > 0));
  assert.equal(analyzeDossier(result.dossier).status, "ready");
});

test("blank OCR text is rejected instead of promoted into the dossier", async () => {
  const result = adaptOcrExtraction(await fixture("missing-text"));
  assert.equal(result.status, "needs_review");
  assert.equal(result.dossier.requestTitle, undefined);
  assert.deepEqual(result.failures.map((item) => `${item.code}:${item.field}`), ["MISSING_TEXT:requestTitle"]);
});

test("low-confidence OCR fields retain an explicit failure state", async () => {
  const result = adaptOcrExtraction(await fixture("low-confidence"));
  assert.equal(result.status, "needs_review");
  assert.equal(result.dossier.applicantReference, undefined);
  assert.deepEqual(result.failures.map((item) => `${item.code}:${item.field}`), ["LOW_CONFIDENCE:applicantReference"]);
});

test("values without provenance are never promoted", async () => {
  const input = await fixture("complete");
  input.fields.requestType.sources = [];
  const result = adaptOcrExtraction(input);
  assert.equal(result.dossier.requestType, undefined);
  assert.ok(result.failures.some((item) => item.code === "MISSING_PROVENANCE" && item.field === "requestType"));
});

test("invalid envelopes and versions return deterministic failures", () => {
  assert.equal(adaptOcrExtraction(null).failures[0].code, "INVALID_INPUT");
  assert.equal(adaptOcrExtraction({ contractVersion: "9.0.0" }).failures[0].code, "UNSUPPORTED_CONTRACT_VERSION");
  assert.equal(adaptOcrExtraction({ contractVersion: OCR_CONTRACT_VERSION }).failures[0].code, "INVALID_ENVELOPE");
});

test("malformed confidence, unknown fields, and invalid threshold are explicit", async () => {
  const malformed = await fixture("complete");
  malformed.fields.requestTitle.confidence = 2;
  malformed.fields.unknown = { value: "x", confidence: 1, sources: [{ page: 1, blockId: "x" }] };
  const result = adaptOcrExtraction(malformed);
  assert.deepEqual(result.failures.map((item) => item.code), ["MALFORMED_FIELD", "UNSUPPORTED_FIELD"]);
  assert.throws(() => adaptOcrExtraction(malformed, { minimumConfidence: -1 }), RangeError);
});

test("schema-forbidden extra properties are rejected at every input level", async () => {
  const envelope = await fixture("complete");
  envelope.unexpected = true;
  assert.equal(adaptOcrExtraction(envelope).failures[0].code, "INVALID_ENVELOPE");

  const fieldRecord = await fixture("complete");
  fieldRecord.fields.requestTitle.rawText = "duplicate";
  const fieldResult = adaptOcrExtraction(fieldRecord);
  assert.equal(fieldResult.dossier.requestTitle, undefined);
  assert.ok(fieldResult.failures.some((item) => item.code === "MALFORMED_FIELD" && item.field === "requestTitle"));

  const source = await fixture("complete");
  source.fields.requestTitle.sources[0].unexpected = true;
  const sourceResult = adaptOcrExtraction(source);
  assert.equal(sourceResult.dossier.requestTitle, undefined);
  assert.ok(sourceResult.failures.some((item) => item.code === "MISSING_PROVENANCE" && item.field === "requestTitle"));
});

test("field values enforce their field-specific contract types", async () => {
  const input = await fixture("complete");
  input.fields.requestTitle.value = true;
  input.fields.signed.value = "true";
  input.fields.attachments.value = [];
  const result = adaptOcrExtraction(input);
  assert.deepEqual(
    result.failures.map((item) => `${item.code}:${item.field}`),
    ["MISSING_TEXT:requestTitle", "MISSING_TEXT:signed", "MISSING_TEXT:attachments"]
  );
});

test("machine-readable OCR schemas are valid JSON Schema documents", async () => {
  for (const name of ["ocr-adapter-input-v1.schema.json", "ocr-adapter-output-v1.schema.json"]) {
    const schema = JSON.parse(await readFile(new URL(`../schemas/${name}`, import.meta.url), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.ok(schema.$id.includes("govflow-vn"));
  }
});

test("input schema discriminates field values and closes every nested object", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/ocr-adapter-input-v1.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.fields.additionalProperties, false);
  assert.equal(schema.$defs.source.additionalProperties, false);
  for (const definition of ["stringField", "booleanField", "stringArrayField"]) {
    assert.equal(schema.$defs[definition].additionalProperties, false);
  }
  assert.equal(schema.$defs.stringField.properties.value.$ref, "#/$defs/nonBlankString");
  assert.equal(schema.$defs.booleanField.properties.value.type, "boolean");
  assert.equal(schema.$defs.stringArrayField.properties.value.type, "array");
  assert.equal(schema.$defs.stringArrayField.properties.value.minItems, 1);
});
