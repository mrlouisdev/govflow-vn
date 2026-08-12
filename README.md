# GovFlow VN

[![CI](https://github.com/mrlouisdev/govflow-vn/actions/workflows/ci.yml/badge.svg)](https://github.com/mrlouisdev/govflow-vn/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

An evidence-first, offline prototype for auditable Vietnamese public-service dossier checking.

- **Live demo:** https://mrlouisdev.github.io/govflow-vn/demo/
- **Architecture:** [docs/architecture.md](docs/architecture.md)
- **Evaluation protocol:** [docs/evaluation.md](docs/evaluation.md)
- **Roadmap and maintenance:** [docs/maintenance.md](docs/maintenance.md)

## Status and scope

GovFlow VN is currently a **deterministic offline MVP**, not a production administrative system. It demonstrates a narrow, inspectable workflow:

1. ingest a structured synthetic dossier;
2. normalize its fields;
3. detect missing or inconsistent information with deterministic rules;
4. attach a source identifier to every finding;
5. refuse unsupported questions instead of guessing; and
6. return an audit record for evaluation.

OCR ingestion, Vietnamese SLM/RAG, authoritative procedure rulesets, and production deployment are roadmap items. They are not claimed as implemented features.

## Why this repository exists

The independent VietDoc Edge team developed this public MVP while preparing its GovFlow VN concept for [A.I Thực Chiến 2026](https://thucchien.ai/). The repository makes the implemented baseline, synthetic examples, architecture, and evaluation method independently inspectable. This statement records project context only; it does not claim competition selection, endorsement, or an award.

The longer-term research question is whether a small, local-first Vietnamese workflow can provide useful dossier checks while keeping citations, refusal behavior, and resource use measurable.

## Implemented now

- Offline deterministic dossier-validation engine.
- Findings with source identifiers for each triggered rule.
- Out-of-scope question guard.
- Reproducible synthetic dossier samples.
- Versioned synthetic benchmark dataset, harness, and machine-readable result.
- Browser demo and automated Node.js tests.
- Architecture and evaluation specifications for future OCR and Vietnamese SLM/RAG adapters.

## Reproduce locally

Prerequisite: Node.js 20 or newer. The current MVP has no runtime package dependencies.

```powershell
git clone https://github.com/mrlouisdev/govflow-vn.git
cd govflow-vn
node --version
npm test
npm run benchmark
```

`npm test` must exit with code `0`. `npm run benchmark` writes the versioned result to `benchmarks/results/v0.1.0.json`; interpret it only as evidence for the bundled synthetic cases. To inspect the browser demo locally:

```powershell
npm run serve
```

Then open `http://127.0.0.1:8080/demo/`. Stop the server with `Ctrl+C`.

## Repository map

```text
demo/       Browser UI
examples/   Synthetic dossier samples
src/        Deterministic evaluation engine
tests/      Automated tests
benchmarks/ Versioned synthetic evaluation data, harness, and results
docs/       Architecture, evaluation, and maintenance notes
scripts/    Local run helpers
```

## Evaluation targets

The published [evaluation protocol](docs/evaluation.md) defines missing-field recall, citation coverage and correctness, out-of-scope recall, latency, and memory measurements. Run `npm run benchmark` to regenerate the bundled synthetic evaluation result. A score should not be reported without its dataset version, engine version, and raw evaluation log.

## Limitations

- Bundled dossiers and rules are synthetic and do not represent an official administrative procedure.
- The MVP accepts structured JSON; it does not currently extract content from PDF files or images.
- Source identifiers refer to the synthetic demo ruleset, not Vietnamese legal authority.
- The scope guard is deterministic and narrow; it is not a general hallucination detector.
- No production privacy, identity, authorization, accessibility, or availability review has been completed.
- Bundled benchmark results describe synthetic cases only; they are not evidence of real-world accuracy, production performance, or adoption.

## Maintenance and contributions

The primary maintainer is [@mrlouisdev](https://github.com/mrlouisdev). Maintainer scope, review expectations, and the public roadmap are documented in [MAINTAINERS.md](MAINTAINERS.md) and [docs/maintenance.md](docs/maintenance.md).

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. For security-sensitive reports, follow [SECURITY.md](SECURITY.md). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
