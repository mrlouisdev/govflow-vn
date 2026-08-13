# Changelog

All notable user-visible changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for releases.

## Unreleased

No unreleased changes.

## 0.2.0 - 2026-08-14

### Added

- Added a versioned OCR adapter contract with input/output JSON Schemas, confidence gates, source provenance, explicit failure states, synthetic fixtures, and regression tests.
- Expanded the synthetic benchmark to 39 dossier, OCR-adapter, and scope cases, including conflicting-field, ruleset-version, date/type boundary, lexical scope-confusable, OCR success, missing-text, and low-confidence slices.
- Added exact expected finding labels (`code`, `field`, `severity`, and `citation`), expected status, finding precision/recall/F1, exact citation correctness, status accuracy, scope metrics, and per-slice evidence while retaining explicit missing-field detection, citation coverage, and out-of-scope refusal metrics for compatibility.
- Added deterministic benchmark verification with dataset, executable-source manifest, and evaluation hashes plus CI thresholds.
- Separated volatile local runtime observations, including raw latency samples, from the tracked deterministic validation artifact.
- Added bug, feature, and evaluation issue forms; a pull-request template; and a project Code of Conduct.
- Added local-server regression coverage for asset allowlisting, traversal attempts, repository metadata, methods, and `HEAD` behavior.

### Changed

- Updated package and benchmark engine evidence to version 0.2.0.
- Hardened dossier handling for null and non-object inputs and validated calendar dates rather than date shape alone.
- Tightened the deterministic scope guard against substring false positives while covering related dossier language.
- Replaced demo HTML string rendering with safe DOM text nodes and added labels, live regions, error focus, and visible keyboard focus states.
- Restricted the local demo server to explicit public assets and added security response headers.

## 0.1.0 - 2026-08-12

### Added

- Offline deterministic dossier-validation engine.
- Synthetic complete and incomplete dossier examples.
- Citation-bearing findings, scope guard, and audit output.
- Automated Node.js tests.
- Static browser demo, architecture notes, and evaluation protocol.
- Contributor, maintainer, security, and maintenance documentation.
- A project `NOTICE` file alongside the canonical Apache-2.0 license text.
- Reproducible verification and explicit limitation sections in the README.
- Versioned synthetic benchmark data, a reproducible harness, machine-readable results, and regression coverage.
- GitHub Actions continuous integration for tests and benchmarks.

### Changed

- Replaced the abbreviated license notice with the full Apache License 2.0 text.
- Clarified the implemented deterministic MVP boundary and separated it from OCR and Vietnamese SLM/RAG roadmap work.
