import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDataset, loadDataset, measureRuntime, percentile } from "../benchmarks/run.mjs";

const dataset = await loadDataset();

test("benchmark dataset is versioned, synthetic, and has unique case IDs", () => {
  assert.equal(dataset.version, "0.1.0");
  assert.match(dataset.description, /Synthetic/);
  assert.ok(dataset.dossiers.length >= 6);
  assert.ok(dataset.questions.length >= 6);
  const ids = [...dataset.dossiers, ...dataset.questions].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("benchmark computes missing-component recall from known labels", () => {
  const { metrics } = evaluateDataset(dataset);
  assert.ok(metrics.missingFieldDetection.knownOmissions > 0);
  assert.equal(metrics.missingFieldDetection.detectedOmissions, metrics.missingFieldDetection.knownOmissions);
  assert.equal(metrics.missingFieldDetection.recall, 1);
  assert.equal(metrics.missingFieldDetection.precision, 1);
});

test("benchmark computes citation coverage over actual findings", () => {
  const { metrics } = evaluateDataset(dataset);
  assert.ok(metrics.citationCoverage.totalFindings > 0);
  assert.equal(metrics.citationCoverage.citedFindings, metrics.citationCoverage.totalFindings);
  assert.equal(metrics.citationCoverage.coverage, 1);
});

test("benchmark evaluates unsupported refusals and supported acceptance separately", () => {
  const { metrics } = evaluateDataset(dataset);
  assert.equal(metrics.outOfScopeRefusal.refusedUnsupported, metrics.outOfScopeRefusal.unsupportedQuestions);
  assert.equal(metrics.outOfScopeRefusal.recall, 1);
  assert.equal(metrics.outOfScopeRefusal.acceptedSupported, metrics.outOfScopeRefusal.supportedQuestions);
  assert.equal(metrics.outOfScopeRefusal.inScopeAcceptance, 1);
});

test("benchmark case log preserves slices and expected-versus-actual evidence", () => {
  const { cases } = evaluateDataset(dataset);
  assert.ok(cases.dossiers.some((item) => item.slice === "complete"));
  assert.ok(cases.dossiers.some((item) => item.slice === "single-omission"));
  assert.ok(cases.dossiers.some((item) => item.slice === "multiple-omissions"));
  assert.ok(cases.dossiers.some((item) => item.slice === "validation-findings"));
  assert.ok(cases.dossiers.every((item) => item.missedExpected.length === 0));
  assert.ok(cases.dossiers.every((item) => item.unexpectedMissing.length === 0));
  assert.ok(cases.questions.every((item) => item.correct));
});

test("runtime measurement reports the exact call count and observed memory", () => {
  const runtime = measureRuntime(dataset, 2);
  assert.equal(runtime.callsMeasured, 2 * (dataset.dossiers.length + dataset.questions.length));
  assert.equal(runtime.rawLatencySamplesMs.length, runtime.callsMeasured);
  assert.ok(runtime.latencyMs.p50 >= 0);
  assert.ok(runtime.latencyMs.p95 >= runtime.latencyMs.p50);
  assert.ok(runtime.memoryBytes.maxObservedRss >= runtime.memoryBytes.baselineRss);
  assert.ok(runtime.memoryBytes.maxObservedHeapUsed > 0);
});

test("percentile uses nearest-rank selection without mutating input", () => {
  const values = [9, 1, 5, 3];
  assert.equal(percentile(values, 50), 3);
  assert.equal(percentile(values, 95), 9);
  assert.deepEqual(values, [9, 1, 5, 3]);
});
