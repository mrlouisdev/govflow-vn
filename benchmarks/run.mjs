import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import process from "node:process";
import { analyzeDossier, answerScope } from "../src/engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const defaultDatasetPath = resolve(here, "dataset/v0.1.0.json");
const defaultOutputPath = resolve(here, "results/v0.1.0.json");
const enginePath = resolve(here, "../src/engine.mjs");

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function percentile(values, percentileRank) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * ordered.length) - 1;
  return ordered[Math.max(0, Math.min(index, ordered.length - 1))];
}

function missingKey(finding) {
  return `${finding.code}:${finding.field}`;
}

export function evaluateDataset(dataset) {
  const dossierCases = [];
  let knownOmissions = 0;
  let detectedOmissions = 0;
  let reportedOmissions = 0;
  let citedFindings = 0;
  let totalFindings = 0;

  for (const item of dataset.dossiers) {
    const result = analyzeDossier(item.input);
    const expected = new Set(item.expectedMissing);
    const actual = result.findings
      .filter((finding) => finding.code === "MISSING_FIELD" || finding.code === "MISSING_ATTACHMENT")
      .map(missingKey);
    const actualSet = new Set(actual);
    const detected = [...expected].filter((key) => actualSet.has(key));
    const unexpected = actual.filter((key) => !expected.has(key));

    knownOmissions += expected.size;
    detectedOmissions += detected.length;
    reportedOmissions += actual.length;
    totalFindings += result.findings.length;
    citedFindings += result.findings.filter(
      (finding) => typeof finding.citation === "string" && finding.citation.trim().length > 0
    ).length;

    dossierCases.push({
      id: item.id,
      slice: item.slice,
      status: result.status,
      expectedMissing: [...expected],
      actualMissing: actual,
      missedExpected: [...expected].filter((key) => !actualSet.has(key)),
      unexpectedMissing: unexpected,
      findingCodes: result.findings.map((finding) => `${finding.code}:${finding.field}`),
      citedFindings: result.findings.filter((finding) => finding.citation).length,
      totalFindings: result.findings.length
    });
  }

  const questionCases = [];
  let unsupportedQuestions = 0;
  let refusedUnsupported = 0;
  let supportedQuestions = 0;
  let acceptedSupported = 0;

  for (const item of dataset.questions) {
    const result = answerScope(item.text);
    if (item.expectedSupported) {
      supportedQuestions += 1;
      if (result.supported) acceptedSupported += 1;
    } else {
      unsupportedQuestions += 1;
      if (!result.supported) refusedUnsupported += 1;
    }
    questionCases.push({
      id: item.id,
      slice: item.slice,
      expectedSupported: item.expectedSupported,
      actualSupported: result.supported,
      correct: result.supported === item.expectedSupported
    });
  }

  return {
    metrics: {
      missingFieldDetection: {
        knownOmissions,
        detectedOmissions,
        reportedOmissions,
        recall: knownOmissions === 0 ? null : round(detectedOmissions / knownOmissions),
        precision: reportedOmissions === 0 ? null : round(detectedOmissions / reportedOmissions)
      },
      citationCoverage: {
        citedFindings,
        totalFindings,
        coverage: totalFindings === 0 ? null : round(citedFindings / totalFindings)
      },
      outOfScopeRefusal: {
        unsupportedQuestions,
        refusedUnsupported,
        recall: unsupportedQuestions === 0 ? null : round(refusedUnsupported / unsupportedQuestions),
        supportedQuestions,
        acceptedSupported,
        inScopeAcceptance: supportedQuestions === 0 ? null : round(acceptedSupported / supportedQuestions)
      }
    },
    cases: { dossiers: dossierCases, questions: questionCases }
  };
}

export function measureRuntime(dataset, iterations = 100) {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new TypeError("iterations must be a positive integer");
  }

  const samplesMs = [];
  const memoryBefore = process.memoryUsage();
  let maxObservedRssBytes = memoryBefore.rss;
  let maxObservedHeapUsedBytes = memoryBefore.heapUsed;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const item of dataset.dossiers) {
      const started = performance.now();
      analyzeDossier(item.input);
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
  }

  return {
    iterations,
    callsMeasured: samplesMs.length,
    latencyMs: {
      p50: round(percentile(samplesMs, 50)),
      p95: round(percentile(samplesMs, 95)),
      min: round(Math.min(...samplesMs)),
      max: round(Math.max(...samplesMs))
    },
    memoryBytes: {
      baselineRss: memoryBefore.rss,
      maxObservedRss: maxObservedRssBytes,
      observedRssDelta: maxObservedRssBytes - memoryBefore.rss,
      maxObservedHeapUsed: maxObservedHeapUsedBytes,
      method: "process.memoryUsage sampled immediately after each measured call; values describe this Node.js process, not per-request allocation"
    },
    rawLatencySamplesMs: samplesMs.map((value) => round(value))
  };
}

export async function loadDataset(path = defaultDatasetPath) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function runBenchmark({ datasetPath = defaultDatasetPath, outputPath = defaultOutputPath, iterations = 100 } = {}) {
  const [datasetSource, engineSource] = await Promise.all([
    readFile(datasetPath, "utf8"),
    readFile(enginePath, "utf8")
  ]);
  const dataset = JSON.parse(datasetSource);
  const evaluation = evaluateDataset(dataset);
  const runtime = measureRuntime(dataset, iterations);
  const report = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    dataset: {
      id: dataset.id,
      version: dataset.version,
      rulesetId: dataset.rulesetId,
      dossierCases: dataset.dossiers.length,
      questionCases: dataset.questions.length,
      synthetic: true,
      sha256: sha256(datasetSource)
    },
    engine: {
      id: "govflow-deterministic-mvp/0.1.0",
      sha256: sha256(engineSource)
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    methodology: {
      missingFieldDetection: "Known required-field and required-attachment omissions detected / all labeled omissions in the synthetic dataset.",
      citationCoverage: "Findings with a non-empty citation string / all findings emitted for dossier cases.",
      outOfScopeRefusal: "Labeled unsupported questions refused / all labeled unsupported questions; supported acceptance is reported separately.",
      latency: "Wall-clock duration of each synchronous engine call measured with performance.now(); p50 and p95 use nearest rank.",
      memory: "Node.js process.memoryUsage sampled immediately after each call; this is observed process memory, not per-request allocation."
    },
    ...evaluation,
    runtime
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, outputPath };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const configuredIterations = Number.parseInt(process.env.GOVFLOW_BENCHMARK_ITERATIONS || "100", 10);
  const { report, outputPath } = await runBenchmark({ iterations: configuredIterations });
  const metrics = report.metrics;
  console.log(`Dataset: ${report.dataset.id} (${report.dataset.dossierCases} dossiers, ${report.dataset.questionCases} questions)`);
  console.log(`Missing-field recall: ${metrics.missingFieldDetection.recall}`);
  console.log(`Citation coverage: ${metrics.citationCoverage.coverage}`);
  console.log(`Out-of-scope refusal recall: ${metrics.outOfScopeRefusal.recall}`);
  console.log(`Latency p50/p95: ${report.runtime.latencyMs.p50}/${report.runtime.latencyMs.p95} ms`);
  console.log(`Max observed RSS: ${report.runtime.memoryBytes.maxObservedRss} bytes`);
  console.log(`Result: ${outputPath}`);
}
