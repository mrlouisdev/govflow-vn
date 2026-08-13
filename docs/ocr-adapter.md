# OCR adapter contract

GovFlow v0.2.0 defines a versioned boundary between an OCR system and the deterministic dossier engine. It does **not** ship an OCR model or claim accuracy on real documents.

## Contract

- Adapter: `govflow-ocr-contract/0.2.0`
- Contract version: `1.0.0`
- Input schema: [`schemas/ocr-adapter-input-v1.schema.json`](../schemas/ocr-adapter-input-v1.schema.json)
- Output schema: [`schemas/ocr-adapter-output-v1.schema.json`](../schemas/ocr-adapter-output-v1.schema.json)
- Implementation: [`src/ocr-adapter.mjs`](../src/ocr-adapter.mjs)

Each input field contains a typed value, a confidence from `0` to `1`, and at least one source with a page and block identifier. The adapter promotes only supported values at or above the configured threshold with valid provenance. Every promoted dossier value has a matching entry in `provenance`.

## Failure states

| Code | Meaning | Promotion behavior |
|---|---|---|
| `INVALID_INPUT` | Input is not an object | No dossier |
| `UNSUPPORTED_CONTRACT_VERSION` | Contract version is not `1.0.0` | No dossier |
| `INVALID_ENVELOPE` | `documentId` or `fields` is missing | No dossier |
| `UNSUPPORTED_FIELD` | OCR output includes an unknown field | Field rejected |
| `MALFORMED_FIELD` | Confidence or field record is invalid | Field rejected |
| `MISSING_TEXT` | Extracted value is blank or has the wrong type | Field rejected |
| `MISSING_PROVENANCE` | No valid page/block source exists | Field rejected |
| `LOW_CONFIDENCE` | Confidence is below the threshold | Field rejected |

`invalid` means the envelope cannot be processed. `needs_review` means at least one field was rejected while safe fields remain available. `ready` means every supplied field passed the adapter boundary; the dossier must still pass the deterministic rules engine.

## Synthetic fixtures

- [`examples/ocr/complete.json`](../examples/ocr/complete.json)
- [`examples/ocr/missing-text.json`](../examples/ocr/missing-text.json)
- [`examples/ocr/low-confidence.json`](../examples/ocr/low-confidence.json)

These fixtures are synthetic and contain no production or official-procedure data.
