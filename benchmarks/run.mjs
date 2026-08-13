import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import process from "node:process";
import { analyzeDossier, answerScope } from "../src/engine.mjs";
import { adaptOcrExtraction } from "../src/ocr-adapter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const defaultDatasetPath = resolve(here, "dataset/v0.2.0.json");
const defaultValidationPath = resolve(here, "results/v0.2.0.validation.json");
const defaultRuntimePath = resolve(here, "results/v0.2.0.runtime.json");
const defaultSourceFiles = [
  { label: "benchmarks/run.mjs", path: fileURLToPath(import.meta.url) },
  { label: "src/engine.mjs", path: resolve(here, "../src/engine.mjs") },
  { label: "src/ocr-adapter.mjs", path: resolve(here, "../src/ocr-adapter.mjs") }
];

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalText(value) {
  return value.replace(/\r\n?/g, "\n");
}

export async function buildSourceEvidence(sourceFiles = defaultSourceFiles) {
  const sources = await Promise.all(sourceFiles.map(async ({ label, path }) => ({
    path: label,
    sha256: sha256(canonicalText(await readFile(path, "utf8")))
  })));
  sources.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return {
    algorithm: "sha256",
    canonicalization: "UTF-8 text with CRLF and CR normalized to LF; source manifest sorted by path.",
    sha256: sha256(canonicalJson(sources)),
    sources
  };
}

function findingKey(finding) {
  return [finding.code, finding.field, finding.severity, finding.citation].join("\u001f");
}

function omissionKey(finding) {
  return [finding.code, finding.field].join("\u001f");
}

function isRequiredOmission(finding) {
  return finding.code === "MISSING_FIELD" || finding.code === "MISSING_ATTACHMENT";
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : round(numerator / denominator);
}

function f1(precision, recall) {
  return precision === null || recall === null || precision + recall === 0
    ? null
    : round((2 * precision * recall) / (precision + recall));
}

export function percentile(values, percentileRank) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * ordered.length) - 1;
  return ordered[Math.max(0, Math.min(index, ordered.length - 1))];
}

export function evaluateDataset(dataset) {
  const dossierCases = [];
  let truePositiveFindings = 0;
  let expectedFindings = 0;
  let actualFindings = 0;
  let correctCitations = 0;
  let citedFindings = 0;
  let knownOmissions = 0;
  let detectedOmissions = 0;
  let reportedOmissions = 0;
  let statusCorrect = 0;

  for (const item of dataset.dossiers) {
    const result = analyzeDossier(item.input, item.ruleset);
    const expectedKeys = new Set(item.expectedFindings.map(findingKey));
    const actualKeys = new Set(result.findings.map(findingKey));
    const matched = [...expectedKeys].filter((key) => actualKeys.has(key));
    const missed = item.expectedFindings.filter((finding) => !actualKeys.has(findingKey(finding)));
    const unexpected = result.findings.filter((finding) => !expectedKeys.has(findingKey(finding)));
    const expectedByCodeFieldSeverity = new Map(
      item.expectedFindings.map((finding) => [[finding.code, finding.field, finding.severity].join("\u001f"), finding])
    );
    const citationMatches = result.findings.filter((finding) => {
      const expected = expectedByCodeFieldSeverity.get([finding.code, finding.field, finding.severity].join("\u001f"));
      return expected?.citation === finding.citation;
    }).length;
    const expectedOmissions = item.expectedFindings.filter(isRequiredOmission);
    const actualOmissions = result.findings.filter(isRequiredOmission);
    const expectedOmissionKeys = new Set(expectedOmissions.map(omissionKey));
    const actualOmissionKeys = new Set(actualOmissions.map(omissionKey));
    const matchedOmissions = [...expectedOmissionKeys].filter((key) => actualOmissionKeys.has(key)).length;
    const isStatusCorrect = result.status === item.expectedStatus;

    truePositiveFindings += matched.length;
    expectedFindings += expectedKeys.size;
    actualFindings += actualKeys.size;
    correctCitations += citationMatches;
    citedFindings += result.findings.filter((finding) => typeof finding.citation === "string" && finding.citation.length > 0).length;
    knownOmissions += expectedOmissionKeys.size;
    detectedOmissions += matchedOmissions;
    reportedOmissions += actualOmissionKeys.size;
    if (isStatusCorrect) statusCorrect += 1;

    dossierCases.push({
      id: item.id,
      slice: item.slice,
      expectedStatus: item.expectedStatus,
      actualStatus: result.status,
      statusCorrect: isStatusCorrect,
      expectedFindings: item.expectedFindings,
      actualFindings: result.findings.map(({ code, field, severity, citation }) => ({ code, field, severity, citation })),
      matchedFindings: matched.length,
      missedExpected: missed,
      unexpectedActual: unexpected.map(({ code, field, severity, citation }) => ({ code, field, severity, citation })),
      expectedOmissions: expectedOmissions.map(({ code, field }) => ({ code, field })),
      actualOmissions: actualOmissions.map(({ code, field }) => ({ code, field })),
      matchedOmissions,
      correctCitations: citationMatches,
      exact: missed.length === 0 && unexpected.length === 0 && isStatusCorrect
    });
  }

  const findingPrecision = ratio(truePositiveFindings, actualFindings);
  const findingRecall = ratio(truePositiveFindings, expectedFindings);
  const questionCases = [];
  let truePositiveScope = 0;
  let trueNegativeScope = 0;
  let falsePositiveScope = 0;
  let falseNegativeScope = 0;

  for (const item of dataset.questions) {
    const result = answerScope(item.text);
    if (item.expectedSupported && result.supported) truePositiveScope += 1;
    else if (!item.expectedSupported && !result.supported) trueNegativeScope += 1;
    else if (!item.expectedSupported && result.supported) falsePositiveScope += 1;
    else falseNegativeScope += 1;
    questionCases.push({
      id: item.id,
      slice: item.slice,
      expectedSupported: item.expectedSupported,
      actualSupported: result.supported,
      correct: result.supported === item.expectedSupported
    });
  }

  const scopePrecision = ratio(truePositiveScope, truePositiveScope + falsePositiveScope);
  const scopeRecall = ratio(truePositiveScope, truePositiveScope + falseNegativeScope);
  const ocrCases = [];
  let correctOcrCases = 0;
  let correctOcrProvenance = 0;

  for (const item of dataset.ocrCases ?? []) {
    const result = adaptOcrExtraction(item.input, { minimumConfidence: item.minimumConfidence });
    const actualFailures = result.failures.map(({ code, field }) => ({ code, field }));
    const statusCorrect = result.status === item.expectedStatus;
    const dossierCorrect = canonicalJson(result.dossier) === canonicalJson(item.expectedDossier);
    const failuresCorrect = canonicalJson(actualFailures) === canonicalJson(item.expectedFailures);
    const provenanceCorrect = canonicalJson(result.provenance) === canonicalJson(item.expectedProvenance);
    const auditCorrect = canonicalJson(result.audit) === canonicalJson(item.expectedAudit);
    const exact = statusCorrect && dossierCorrect && failuresCorrect && provenanceCorrect && auditCorrect;
    if (exact) correctOcrCases += 1;
    if (provenanceCorrect) correctOcrProvenance += 1;
    ocrCases.push({
      id: item.id,
      slice: item.slice,
      expectedStatus: item.expectedStatus,
      actualStatus: result.status,
      statusCorrect,
      expectedDossier: item.expectedDossier,
      actualDossier: result.dossier,
      dossierCorrect,
      expectedFailures: item.expectedFailures,
      actualFailures,
      failuresCorrect,
      expectedProvenance: item.expectedProvenance,
      actualProvenance: result.provenance,
      provenanceCorrect,
      expectedAudit: item.expectedAudit,
      actualAudit: result.audit,
      auditCorrect,
      exact
    });
  }

  const allCases = [...dossierCases, ...ocrCases, ...questionCases];
  const sliceEvidence = Object.fromEntries([...new Set(allCases.map((item) => item.slice))].sort().map((slice) => {
    const cases = allCases.filter((item) => item.slice === slice);
    const correct = cases.filter((item) => item.exact === true || item.correct === true).length;
    return [slice, { cases: cases.length, correct, accuracy: ratio(correct, cases.length), caseIds: cases.map((item) => item.id) }];
  }));

  return {
    metrics: {
      findingDetection: {
        truePositiveFindings,
        expectedFindings,
        actualFindings,
        precision: findingPrecision,
        recall: findingRecall,
        f1: f1(findingPrecision, findingRecall)
      },
      missingFieldDetection: {
        knownOmissions,
        detectedOmissions,
        reportedOmissions,
        recall: ratio(detectedOmissions, knownOmissions),
        precision: ratio(detectedOmissions, reportedOmissions)
      },
      exactCitationCorrectness: {
        correctCitations,
        actualFindings,
        accuracy: ratio(correctCitations, actualFindings)
      },
      citationCoverage: {
        citedFindings,
        totalFindings: actualFindings,
        coverage: ratio(citedFindings, actualFindings)
      },
      statusAccuracy: {
        correct: statusCorrect,
        total: dataset.dossiers.length,
        accuracy: ratio(statusCorrect, dataset.dossiers.length)
      },
      scopeClassification: {
        truePositive: truePositiveScope,
        trueNegative: trueNegativeScope,
        falsePositive: falsePositiveScope,
        falseNegative: falseNegativeScope,
        precision: scopePrecision,
        recall: scopeRecall,
        f1: f1(scopePrecision, scopeRecall),
        accuracy: ratio(truePositiveScope + trueNegativeScope, dataset.questions.length)
      },
      outOfScopeRefusal: {
        unsupportedQuestions: trueNegativeScope + falsePositiveScope,
        refusedUnsupported: trueNegativeScope,
        recall: ratio(trueNegativeScope, trueNegativeScope + falsePositiveScope),
        supportedQuestions: truePositiveScope + falseNegativeScope,
        acceptedSupported: truePositiveScope,
        inScopeAcceptance: ratio(truePositiveScope, truePositiveScope + falseNegativeScope)
      },
      ocrAdapter: {
        correct: correctOcrCases,
        total: ocrCases.length,
        accuracy: ratio(correctOcrCases, ocrCases.length),
        provenanceCorrect: correctOcrProvenance,
        provenanceAccuracy: ratio(correctOcrProvenance, ocrCases.length)
      }
    },
    sliceEvidence,
    cases: { dossiers: dossierCases, ocr: ocrCases, questions: questionCases }
  };
}

export function measureRuntime(dataset, iterations = 100) {
  if (!Number.isInteger(iterations) || iterations < 1) throw new TypeError("iterations must be a positive integer");
  const samplesMs = [];
  const memoryBefore = process.memoryUsage();
  let maxObservedRssBytes = memoryBefore.rss;
  let maxObservedHeapUsedBytes = memoryBefore.heapUsed;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const item of dataset.dossiers) {
      const started = performance.now();
      analyzeDossier(item.input, item.ruleset);
      samplesMs.push(performance.now() - started);
      const memory = process.memoryUsage();
      maxObservedRssBytes = Math.max(maxObservedRssBytes, memory.rss);
      maxObservedHeapUsedBytes = Math.max(maxObservedHeapUsedBytes, memory.heapUsed);
    }
    for (const item of dataset.questions) {
      const started = performance.now();
      answerScope(item.text);
      samplesMs.push(performance.now() - started);
      const memory = process.memoryUsage();
      maxObservedRssBytes = Math.max(maxObservedRssBytes, memory.rss);
      maxObservedHeapUsedBytes = Math.max(maxObservedHeapUsedBytes, memory.heapUsed);
    }
    for (const item of dataset.ocrCases ?? []) {
      const started = performance.now();
      adaptOcrExtraction(item.input, { minimumConfidence: item.minimumConfidence });
      samplesMs.push(performance.now() - started);
      const memory = process.memoryUsage();
      maxObservedRssBytes = Math.max(maxObservedRssBytes, memory.rss);
      maxObservedHeapUsedBytes = Math.max(maxObservedHeapUsedBytes, memory.heapUsed);
    }
  }
  return {
    iterations,
    callsMeasured: samplesMs.length,
    latencyMs: {
      p50: round(percentile(samplesMs, 50)), p95: round(percentile(samplesMs, 95)),
      min: round(Math.min(...samplesMs)), max: round(Math.max(...samplesMs))
    },
    memoryBytes: {
      baselineRss: memoryBefore.rss, maxObservedRss: maxObservedRssBytes,
      observedRssDelta: maxObservedRssBytes - memoryBefore.rss,
      maxObservedHeapUsed: maxObservedHeapUsedBytes,
      method: "process.memoryUsage sampled after each call; process-level observation, not per-request allocation"
    },
    rawLatencySamplesMs: samplesMs.map((value) => round(value))
  };
}

export async function loadDataset(path = defaultDatasetPath) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function buildValidation({ datasetPath = defaultDatasetPath, sourceFiles = defaultSourceFiles } = {}) {
  const datasetSource = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(datasetSource);
  const evaluation = evaluateDataset(dataset);
  const evaluationSha256 = sha256(canonicalJson(evaluation));
  const sourceEvidence = await buildSourceEvidence(sourceFiles);
  return {
    schemaVersion: "2.1.0",
    dataset: {
      id: dataset.id, version: dataset.version, rulesetId: dataset.rulesetId,
      dossierCases: dataset.dossiers.length, ocrCases: dataset.ocrCases?.length ?? 0,
      questionCases: dataset.questions.length,
      synthetic: true, sha256: sha256(canonicalJson(dataset))
    },
    engine: { id: "govflow-deterministic-mvp/0.2.0", ...sourceEvidence },
    evaluationSha256,
    methodology: {
      findingDetection: "Micro precision, recall, and F1 over exact code+field+severity+citation finding tuples.",
      missingFieldDetection: "Precision and recall over labeled required-field and required-attachment omission code+field pairs.",
      citationCorrectness: "Exact citation equality for each emitted finding matched by code+field+severity.",
      citationCoverage: "Emitted findings with a non-empty citation string / all emitted findings; exact correctness is reported separately.",
      statusAccuracy: "Exact ready/needs_review equality per dossier.",
      scopeClassification: "Precision, recall, F1, and accuracy for supported=true, including lexical-confusable negatives.",
      outOfScopeRefusal: "Labeled unsupported questions refused / all labeled unsupported questions; supported acceptance is reported separately.",
      ocrAdapter: "Exact status, promoted dossier, failure tuple, audit, and field-level confidence/source provenance equality.",
      slices: "Per-slice case IDs, counts, and exact-case accuracy. All fixtures are synthetic."
    },
    ...evaluation
  };
}

export async function writeValidation({ datasetPath = defaultDatasetPath, outputPath = defaultValidationPath } = {}) {
  const report = await buildValidation({ datasetPath });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, outputPath };
}

export async function verifyValidation({ datasetPath = defaultDatasetPath, expectedPath = defaultValidationPath } = {}) {
  const actual = await buildValidation({ datasetPath });
  const expected = JSON.parse(await readFile(expectedPath, "utf8"));
  const failures = [];
  if (canonicalJson(actual) !== canonicalJson(expected)) failures.push("validation artifact differs from current dataset/evaluator output");
  const thresholds = {
    findingPrecision: actual.metrics.findingDetection.precision,
    findingRecall: actual.metrics.findingDetection.recall,
    missingFieldPrecision: actual.metrics.missingFieldDetection.precision,
    missingFieldRecall: actual.metrics.missingFieldDetection.recall,
    citationAccuracy: actual.metrics.exactCitationCorrectness.accuracy,
    citationCoverage: actual.metrics.citationCoverage.coverage,
    statusAccuracy: actual.metrics.statusAccuracy.accuracy,
    scopeF1: actual.metrics.scopeClassification.f1,
    unsupportedRefusalRecall: actual.metrics.outOfScopeRefusal.recall,
    supportedAcceptance: actual.metrics.outOfScopeRefusal.inScopeAcceptance,
    ocrAccuracy: actual.metrics.ocrAdapter.accuracy,
    ocrProvenanceAccuracy: actual.metrics.ocrAdapter.provenanceAccuracy
  };
  for (const [name, value] of Object.entries(thresholds)) if (value !== 1) failures.push(`${name} expected 1, received ${value}`);
  if (actual.dataset.dossierCases + actual.dataset.ocrCases + actual.dataset.questionCases < 30) failures.push("dataset must contain at least 30 total cases");
  if (!/^[a-f0-9]{64}$/.test(actual.engine.sha256) || actual.engine.sources.length < 2) failures.push("engine source hash evidence is incomplete");
  if (failures.length) throw new Error(`Benchmark verification failed: ${failures.join("; ")}`);
  return actual;
}

export async function writeRuntime({ datasetPath = defaultDatasetPath, outputPath = defaultRuntimePath, iterations = 100, sourceFiles = defaultSourceFiles } = {}) {
  const datasetSource = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(datasetSource);
  const sourceEvidence = await buildSourceEvidence(sourceFiles);
  const report = {
    schemaVersion: "1.1.0", generatedAt: new Date().toISOString(),
    dataset: { id: dataset.id, sha256: sha256(canonicalJson(dataset)) },
    engine: { id: "govflow-deterministic-mvp/0.2.0", ...sourceEvidence },
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    caveat: "Volatile local observation. Values vary with hardware, OS, Node.js, warm-up, and competing load; do not compare as production performance.",
    runtime: measureRuntime(dataset, iterations)
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, outputPath };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  if (args.has("--verify")) {
    const report = await verifyValidation();
    console.log(`PASS ${report.dataset.id}: ${report.dataset.dossierCases + report.dataset.ocrCases + report.dataset.questionCases} cases, evaluation ${report.evaluationSha256}`);
  } else if (args.has("--runtime")) {
    const iterations = Number.parseInt(process.env.GOVFLOW_BENCHMARK_ITERATIONS || "100", 10);
    const { outputPath } = await writeRuntime({ iterations });
    console.log(`Runtime observation written: ${outputPath}`);
  } else {
    const { report, outputPath } = await writeValidation();
    console.log(`Validation written: ${outputPath}`);
    console.log(`Finding F1/citation/status/scope F1: ${report.metrics.findingDetection.f1}/${report.metrics.exactCitationCorrectness.accuracy}/${report.metrics.statusAccuracy.accuracy}/${report.metrics.scopeClassification.f1}`);
  }
}
