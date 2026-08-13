# Maintenance and roadmap

This document separates shipped behavior from proposed work. Roadmap entries are planning targets, not delivery claims or deadlines.

## Maintenance principles

- Keep the deterministic baseline runnable offline and covered by tests.
- Prefer small, reversible changes with explicit expected behavior.
- Treat citations and refusal behavior as testable contracts.
- Use only synthetic, non-identifying public fixtures.
- Publish no performance claim without a versioned dataset, exact command, engine version, and raw result artifact.
- Keep README status and limitations synchronized with the code.

## Near-term maintenance

- Add reviewed synthetic cases when a new rule or boundary is introduced; keep exact labels and deterministic hashes synchronized.
- Review benchmark results for stability across supported Node.js versions and documented hardware.
- Keep continuous integration aligned with the test and benchmark commands.
- Tag releases with changelog and verification evidence.

## Research roadmap

1. Evaluate OCR implementations against the shipped adapter contract using licensed or synthetic Vietnamese document samples.
2. Add an authoritative, versioned source-corpus interface.
3. Evaluate Vietnamese SLM/RAG adapters for citation correctness and out-of-scope refusal.
4. Measure latency and memory on documented local hardware.
5. Complete privacy, security, accessibility, and operational reviews before any production-data pilot.

## Non-goals for the current MVP

- Interpreting real administrative dossiers.
- Providing legal or official procedural determinations.
- Claiming broad hallucination detection.
- Claiming production readiness or measured adoption.

Ownership and review rules are in [MAINTAINERS.md](../MAINTAINERS.md); contribution steps are in [CONTRIBUTING.md](../CONTRIBUTING.md).
