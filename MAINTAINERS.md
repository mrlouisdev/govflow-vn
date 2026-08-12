# Maintainers

## Current maintainer

| Maintainer | Role | Scope |
|---|---|---|
| [@mrlouisdev](https://github.com/mrlouisdev) | Primary maintainer | Repository direction, releases, reviews, and security coordination |

## Responsibilities

The primary maintainer is responsible for:

- keeping the public description aligned with implemented behavior;
- reviewing changes to rules, citations, tests, and evaluation definitions;
- requiring reproducible evidence before publishing performance claims;
- triaging issues and pull requests as capacity allows;
- recording user-visible changes in `CHANGELOG.md`; and
- maintaining a reversible release history.

## Decision process

1. Discuss material behavior or evaluation changes in a GitHub issue before implementation.
2. Submit the smallest reviewable pull request with tests and documentation.
3. Resolve review comments and keep the branch current with `main`.
4. The primary maintainer makes the final merge and release decision.

There is no guaranteed response-time service level. Lack of an immediate response does not imply rejection. Maintainer membership may be expanded after sustained, constructive contributions and agreement from the current primary maintainer.

## Project integrity

Maintainers must not present roadmap work as shipped, use confidential dossier data in public fixtures, or publish benchmark numbers without the dataset version, engine version, command, and raw result artifact needed to reproduce them.
