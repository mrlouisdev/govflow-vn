# Architecture

```mermaid
flowchart LR
    A[PDF / image dossier] --> B[OCR adapter]
    B --> C[Schema normalizer]
    C --> D[Deterministic rules engine]
    C --> E[Vietnamese DSLM / RAG adapter]
    F[Versioned source corpus] --> E
    D --> G[Cited findings]
    E --> G
    G --> H[Out-of-scope guard]
    H --> I[Audit trail and evaluation]
```

The current MVP implements the schema boundary, deterministic checks, citation attachment, scope guard and audit output. OCR and DSLM/RAG are explicit adapters so they can be evaluated independently.

## Design constraints

- Every conclusion carries a source identifier.
- Unsupported questions return an out-of-scope warning.
- Rulesets and source corpora are versioned.
- Local inference is the default deployment target.
- Evaluation logs are reproducible without private data.

