# Contributing to GovFlow VN

Thank you for helping improve an auditable, local-first dossier-checking workflow.

## Before contributing

- Read [README.md](README.md), [docs/architecture.md](docs/architecture.md), and [docs/evaluation.md](docs/evaluation.md).
- Search existing [issues](https://github.com/mrlouisdev/govflow-vn/issues) before opening a new one.
- For a material feature or evaluation change, open an issue first so scope and evidence can be agreed.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

## Local verification

Use Node.js 20 or newer.

```powershell
git clone https://github.com/mrlouisdev/govflow-vn.git
cd govflow-vn
npm test
```

To inspect the demo:

```powershell
npm run serve
```

Open `http://127.0.0.1:8080/demo/` and stop the server with `Ctrl+C`.

## Pull-request checklist

- Keep the change focused and explain the user-visible behavior.
- Add or update automated tests for behavior changes.
- Run `npm test` and include the command result in the pull request.
- Update relevant documentation and `CHANGELOG.md` for user-visible changes.
- State limitations; do not describe OCR, SLM/RAG, or official rulesets as implemented until code and reproducible evaluation artifacts exist.
- Use synthetic, non-identifying fixtures only. Do not commit confidential inputs or authentication material.
- Preserve citation and audit fields unless the pull request explicitly revises their documented contract.

## Evaluation contributions

Performance or quality claims must identify:

1. dataset and ruleset version;
2. engine version or commit SHA;
3. exact reproduction command;
4. raw machine-readable result; and
5. relevant environment details for latency or memory results.

Synthetic evaluation cases should state the expected result and cover a specific behavior such as a missing field, invalid format, unsupported question, or ruleset-version change.

## Review

The process and ownership model are described in [MAINTAINERS.md](MAINTAINERS.md). Submission of a contribution means it is provided under the repository's [Apache-2.0 license](LICENSE).
