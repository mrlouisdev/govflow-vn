# Evaluation protocol

| Metric | Definition |
|---|---|
| Missing-field recall | Required omissions detected / total known omissions |
| Citation coverage | Findings containing a source identifier / all findings |
| Citation correctness | Findings linked to the correct source clause / sampled findings |
| Out-of-scope recall | Unsupported questions correctly refused / unsupported test questions |
| Latency | Median and p95 processing time |
| Memory | Peak local working-set RAM |

Planned slices: complete samples, single omissions, multiple omissions, conflicting fields, unsupported questions and ruleset-version changes.

No score is published without the dataset version, engine version and raw evaluation log.

