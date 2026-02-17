# rarestg-docs

This folder contains implementation-level reports, handoff notes, and debugging writeups that support changes already landed in the codebase.

## What is in here

- `monaco-editor-bug-report.md`
  - Background investigation and reproduction details for Monaco `inmemory://model/*` warnings.
- `MONACO-INMEMORY-MODEL-WARNING-FIX-GUIDE.md`
  - Practical fix guide for Monaco diagnostic-mode warning cleanup.
- `NEXT-ENGINEER-HANDOFF-MONACO-FRAMER.md`
  - Structured handoff for Monaco + Framer warning follow-up work.
- `sandbox-creation-failure-report.md`
  - Primary report for sandbox/container creation instability and retry behavior.
- `sandbox-creation-failure-report-extra.md`
  - Extended sandbox failure analysis and additional evidence.
- `vault-status-bug-report.md`
  - Report for vault lock/unlock state sync issues and expected behavior.

## Kept at repo root

These two docs are intentionally kept at root because they are high-level references used across the repo:

- `changes-versus-base.md`
- `VIBESDK-ARCHITECTURE-DEEP-DIVE.md`
