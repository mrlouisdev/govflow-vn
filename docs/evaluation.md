# Evaluation protocol

Version 0.2.0 evaluates the deterministic engine against `benchmarks/dataset/v0.2.0.json`. The fixtures are synthetic regression cases, not official procedures, production traffic, or evidence of real-world accuracy.

| Metric | Definition |
|---|---|
| Finding precision | Exact expected findings emitted / all emitted findings |
| Finding recall | Exact expected findings emitted / all expected findings |
| Finding F1 | Harmonic mean of finding precision and recall |
| Missing-field detection precision/recall | Correctly emitted labeled required-field or required-attachment `code + field` omissions / all emitted omissions or all labeled omissions, respectively |
| Exact citation correctness | Emitted findings whose citation exactly equals the label for the same code, field, and severity / all emitted findings |
| Citation coverage | Emitted findings with a non-empty citation / all emitted findings; retained for compatibility and not a substitute for exact citation correctness |
| Status accuracy | Dossiers whose `ready` or `needs_review` status exactly equals the label / all dossiers |
| Scope precision/recall/F1 | Binary classification metrics with `supported=true` as the positive class |
| Scope accuracy | Correct supported/refused decisions / all questions |
| Out-of-scope refusal | Labeled unsupported questions refused / all labeled unsupported questions, with supported-question acceptance reported separately |
| OCR adapter accuracy | Cases with exact adapter status, promoted dossier, failure tuples, audit record, and provenance / all OCR cases |
| OCR provenance accuracy | Cases whose field-level confidence and source locators exactly equal the labels / all OCR cases |
| Slice accuracy | Cases with exact findings+status, or exact scope classification, / cases in each named slice |

Finding identity is the full tuple `code + field + severity + citation`; matching only a code or counting non-empty citations is insufficient. OCR identity includes the exact promoted dossier, `code + field` failure tuples, audit counters, confidence, and page/block/locator provenance. The validation artifact records every expected and actual value, mismatch, status, question decision, slice case ID, dataset SHA-256, executable-source SHA-256 manifest, and a canonical evaluation SHA-256.

The 39 cases include complete dossiers, omissions, validation findings, conflicting fields, alternate ruleset versions, date/type boundaries, unsupported questions, lexical scope-confusables, and three synthetic OCR-adapter slices: successful provenance-preserving promotion, missing text, and a low-confidence rejection. CI runs:

```powershell
npm test
npm run benchmark:verify
```

Verification recomputes the deterministic evaluation in memory, compares it with `benchmarks/results/v0.2.0.validation.json`, enforces at least 30 total cases, and requires finding precision/recall, missing-field precision/recall, exact citation correctness, citation coverage, status accuracy, scope F1, unsupported refusal recall, supported acceptance, OCR exact accuracy, and OCR provenance accuracy to equal 1. It does not rewrite tracked files.

`dataset.sha256` is SHA-256 over canonical JSON. `engine.sha256` is SHA-256 over a path-sorted manifest of the per-file hashes for `src/engine.mjs`, `src/ocr-adapter.mjs`, and `benchmarks/run.mjs`. Text line endings are normalized to LF before hashing, so LF and CRLF checkouts identify the same executable sources. Both hashes appear in deterministic validation and volatile runtime result formats.

Runtime is deliberately separate:

```powershell
npm run benchmark:runtime
```

That command records wall-clock nearest-rank p50/p95, the rounded raw latency sample behind each percentile, and sampled Node.js process memory. Results vary with hardware, OS, Node.js version, warm-up, and competing load; they are local observations, not production-performance claims or comparable allocation measurements.
