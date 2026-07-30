# GovFlow VN

Vietnamese SLM agent concept for auditable public-service dossier checking.

GovFlow VN is an evidence-first prototype for this workflow:

1. ingest a dossier;
2. normalize structured fields;
3. check missing or inconsistent information;
4. attach source citations to every finding;
5. warn when a question is outside the supported knowledge scope;
6. preserve an audit trail for evaluation.

> Current status: deterministic offline MVP. OCR, Vietnamese SLM/RAG and official-procedure rulesets are adapter milestones, not claimed as completed features.

## Run

Requires Node.js 20+.

```powershell
npm test
npm run serve
```

Open `http://localhost:8080/demo/`.

## Implemented

- Offline dossier validation engine.
- Citation attached to each deterministic rule result.
- Out-of-scope question detector.
- Reproducible synthetic samples.
- Automated tests.
- Architecture and evaluation plan for OCR + Vietnamese DSLM/RAG integration.

## Repository map

```text
demo/       Browser UI
examples/   Synthetic dossier samples
src/        Deterministic evaluation engine
tests/      Automated tests
docs/       Architecture and evaluation protocol
scripts/    Local run helpers
```

## Evaluation targets

- citation correctness;
- extraction accuracy;
- missing-field detection;
- hallucination and out-of-scope refusal;
- latency and memory footprint;
- local/offline deployment.

The bundled dossiers and rules are synthetic. They validate the workflow and do not represent an official administrative procedure.

## License

Apache-2.0.

