import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSourceEvidence, buildValidation, evaluateDataset, loadDataset, measureRuntime, percentile, verifyValidation, writeRuntime } from "../benchmarks/run.mjs";

const dataset = await loadDataset();

test("v0.2.0 dataset is synthetic, unique, expanded, and adversarial", () => {
  assert.equal(dataset.version, "0.2.0");
  assert.match(dataset.description, /Synthetic/i);
  assert.ok(dataset.dossiers.length + dataset.questions.length >= 30);
  const ids = [...dataset.dossiers, ...dataset.ocrCases, ...dataset.questions].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  const slices = new Set([...dataset.dossiers, ...dataset.ocrCases, ...dataset.questions].map((item) => item.slice));
  for (const slice of ["conflicting-field", "ruleset-version", "boundary", "scope-confusable", "ocr-success", "ocr-failure", "ocr-confidence"]) assert.ok(slices.has(slice));
  assert.ok(dataset.ocrCases.every((item) => item.input.synthetic === true));
});

test("each dossier has exact finding tuples and expected status", () => {
  for (const item of dataset.dossiers) {
    assert.match(item.expectedStatus, /^(ready|needs_review)$/);
    assert.ok(Array.isArray(item.expectedFindings));
    for (const finding of item.expectedFindings) {
      assert.deepEqual(Object.keys(finding).sort(), ["citation", "code", "field", "severity"]);
      assert.ok(finding.citation.length > 0);
    }
  }
});

test("evaluation achieves exact finding, citation, status, scope, and OCR contracts", () => {
  const { metrics, cases } = evaluateDataset(dataset);
  assert.deepEqual(metrics.findingDetection, {
    truePositiveFindings: metrics.findingDetection.expectedFindings,
    expectedFindings: metrics.findingDetection.expectedFindings,
    actualFindings: metrics.findingDetection.expectedFindings,
    precision: 1, recall: 1, f1: 1
  });
  assert.deepEqual(metrics.missingFieldDetection, {
    knownOmissions: 23,
    detectedOmissions: 23,
    reportedOmissions: 23,
    recall: 1,
    precision: 1
  });
  assert.equal(metrics.exactCitationCorrectness.accuracy, 1);
  assert.deepEqual(metrics.citationCoverage, {
    citedFindings: metrics.findingDetection.actualFindings,
    totalFindings: metrics.findingDetection.actualFindings,
    coverage: 1
  });
  assert.equal(metrics.statusAccuracy.accuracy, 1);
  assert.equal(metrics.scopeClassification.precision, 1);
  assert.equal(metrics.scopeClassification.recall, 1);
  assert.equal(metrics.scopeClassification.f1, 1);
  assert.deepEqual(metrics.outOfScopeRefusal, {
    unsupportedQuestions: 8,
    refusedUnsupported: 8,
    recall: 1,
    supportedQuestions: 8,
    acceptedSupported: 8,
    inScopeAcceptance: 1
  });
  assert.equal(metrics.ocrAdapter.accuracy, 1);
  assert.equal(metrics.ocrAdapter.provenanceAccuracy, 1);
  assert.ok(cases.dossiers.every((item) => item.exact));
  assert.ok(cases.dossiers.every((item) => item.matchedOmissions === item.expectedOmissions.length));
  assert.ok(cases.ocr.every((item) => item.exact && item.provenanceCorrect));
  assert.ok(cases.questions.every((item) => item.correct));
});

test("slice evidence is complete and maps back to case IDs", () => {
  const { sliceEvidence } = evaluateDataset(dataset);
  const expectedCases = dataset.dossiers.length + dataset.ocrCases.length + dataset.questions.length;
  assert.equal(Object.values(sliceEvidence).reduce((sum, slice) => sum + slice.cases, 0), expectedCases);
  assert.ok(Object.values(sliceEvidence).every((slice) => slice.accuracy === 1));
  assert.ok(Object.values(sliceEvidence).every((slice) => slice.caseIds.length === slice.cases));
});

test("validation report is deterministic and verifies tracked evidence", async () => {
  assert.deepEqual(await buildValidation(), await buildValidation());
  const verified = await verifyValidation();
  assert.equal(verified.dataset.version, "0.2.0");
  assert.equal(verified.dataset.ocrCases, 3);
  assert.match(verified.evaluationSha256, /^[a-f0-9]{64}$/);
  assert.match(verified.engine.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(verified.engine.sources.map((item) => item.path), [
    "benchmarks/run.mjs", "src/engine.mjs", "src/ocr-adapter.mjs"
  ]);
});

test("source identity is stable across LF and CRLF checkouts and changes with executable source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "govflow-source-hash-"));
  try {
    const lfPath = join(directory, "lf.mjs");
    const crlfPath = join(directory, "crlf.mjs");
    const changedPath = join(directory, "changed.mjs");
    await writeFile(lfPath, "export const value = 1;\n", "utf8");
    await writeFile(crlfPath, "export const value = 1;\r\n", "utf8");
    await writeFile(changedPath, "export const value = 2;\n", "utf8");
    const [lf, crlf, changed] = await Promise.all([
      buildSourceEvidence([{ label: "src/example.mjs", path: lfPath }]),
      buildSourceEvidence([{ label: "src/example.mjs", path: crlfPath }]),
      buildSourceEvidence([{ label: "src/example.mjs", path: changedPath }])
    ]);
    assert.deepEqual(lf, crlf);
    assert.notEqual(lf.sha256, changed.sha256);
    assert.notEqual(lf.sources[0].sha256, changed.sources[0].sha256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dataset identity is stable across LF and CRLF checkouts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "govflow-benchmark-"));
  try {
    const lfPath = join(directory, "lf.json");
    const crlfPath = join(directory, "crlf.json");
    const source = `${JSON.stringify(dataset, null, 2)}\n`;
    await writeFile(lfPath, source, "utf8");
    await writeFile(crlfPath, source.replace(/\n/g, "\r\n"), "utf8");
    const [lf, crlf] = await Promise.all([
      buildValidation({ datasetPath: lfPath }),
      buildValidation({ datasetPath: crlfPath })
    ]);
    assert.equal(lf.dataset.sha256, crlf.dataset.sha256);
    assert.deepEqual(lf, crlf);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runtime measurement reports exact calls and process observations", () => {
  const runtime = measureRuntime(dataset, 2);
  assert.equal(runtime.callsMeasured, 2 * (dataset.dossiers.length + dataset.ocrCases.length + dataset.questions.length));
  assert.equal(runtime.rawLatencySamplesMs.length, runtime.callsMeasured);
  assert.ok(runtime.rawLatencySamplesMs.every((value) => Number.isFinite(value) && value >= 0));
  assert.ok(runtime.latencyMs.p50 >= 0);
  assert.ok(runtime.latencyMs.p95 >= runtime.latencyMs.p50);
  assert.ok(runtime.memoryBytes.maxObservedRss >= runtime.memoryBytes.baselineRss);
});

test("runtime result carries the same deterministic dataset and source identities", async () => {
  const directory = await mkdtemp(join(tmpdir(), "govflow-runtime-result-"));
  try {
    const outputPath = join(directory, "runtime.json");
    const { report } = await writeRuntime({ outputPath, iterations: 1 });
    const validation = await buildValidation();
    assert.equal(report.dataset.sha256, validation.dataset.sha256);
    assert.equal(report.engine.sha256, validation.engine.sha256);
    assert.deepEqual(report.engine.sources, validation.engine.sources);
    assert.equal(report.runtime.rawLatencySamplesMs.length, report.runtime.callsMeasured);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("percentile uses nearest rank without mutating input", () => {
  const values = [9, 1, 5, 3];
  assert.equal(percentile(values, 50), 3);
  assert.equal(percentile(values, 95), 9);
  assert.deepEqual(values, [9, 1, 5, 3]);
});
