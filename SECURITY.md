# Security Policy

## Supported versions

GovFlow VN is an early prototype. Security fixes are applied to the current `main` branch; older commits and unreleased snapshots are not separately supported.

## Report a vulnerability

Do not open a public issue for an unpatched vulnerability or include sensitive dossier contents in public discussion.

Use the repository Security tab's **Report a vulnerability** form when it is available. If that route is unavailable, contact the primary maintainer through a verified non-public channel listed on the maintainer's GitHub profile. Include:

- affected commit or version;
- reproduction steps using synthetic data;
- expected and observed behavior;
- impact and required preconditions; and
- a minimal remediation suggestion, if known.

The maintainer will acknowledge and triage reports as capacity allows. No fixed response or remediation service level is promised.

## Scope notes

The current MVP runs locally on synthetic structured data and includes a static browser demo. OCR, SLM/RAG, identity, authorization, and production data ingestion are not implemented. Reports should distinguish current code from roadmap architecture.
