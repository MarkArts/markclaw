---
name: sync-adrs
description: Sync ADRs from the architectural-decisions source repo to architecture/adrs/. Use when asked to update ADRs, sync from the architectural-decisions repo, or check for missing/outdated ADR entities.
---

# ADR Sync Skill

## Overview

This skill syncs Architecture Decision Records from the **source of truth** repository (`architecture/repositories/architectural-decisions/repo/docs/decisions/`) to the Atlas architecture entities in `architecture/adrs/`.

The architectural-decisions repo contains the canonical ADR markdown files. Atlas mirrors these as enriched QAS architecture entities with additional metadata (affected systems, workflows, aiContext, implementation status).

## When to Use

- User asks to sync/update ADRs from the source repo
- User asks what ADRs are missing from Atlas
- User asks to check if ADR statuses are up to date
- After `bun run repos:pull` updates the architectural-decisions repo
- When creating a new ADR that was added to the source repo

## Source of Truth

```
architecture/repositories/architectural-decisions/repo/docs/decisions/
├── ADR0001-record-architecture-decisions.md
├── ADR0002-boiler-compliance.md
├── ...
└── ADR0039-multi-chill.md
```

**Naming convention in source:** `ADR####-kebab-title.md` (e.g., `ADR0039-multi-chill.md`)
**Naming convention in Atlas:** `####-kebab-title/` directory with `qas.ts` + `adr.md` (e.g., `0039-multi-chill/`)

## Sync Process

### Step 1: Pull Latest Source

First ensure the source repo is up to date:

```bash
cd architecture/repositories/architectural-decisions/repo && git pull
```

### Step 2: Cross-Reference

Compare ADRs in the source repo vs Atlas:

1. **List source ADRs**: Read all `ADR*.md` files from `architecture/repositories/architectural-decisions/repo/docs/decisions/`
2. **List Atlas ADRs**: Read all directories under `architecture/adrs/`
3. **Identify gaps**:
   - ADRs in source but not in Atlas → need to be created
   - ADRs with status mismatches → need status updates
   - ADRs with content changes → need adr.md refresh

### Step 3: For Each Missing ADR

1. Create directory: `architecture/adrs/####-kebab-title/`
2. Copy the source markdown to `adr.md`
3. Create `qas.ts` following the pattern below
4. Optionally run `/generate-adr-qas ####-kebab-title` for richer metadata

### Step 4: For Each Existing ADR with Updates

1. Compare source status with Atlas `qas.ts` status
2. Copy updated `adr.md` content from source
3. Update status in `qas.ts` if changed (using normalization rules below)

### Step 5: Regenerate Index

```bash
bun run scripts/aggregate-qas.ts   # Regenerate architecture/index.ts
bun run bundle:adrs                 # Rebuild bundled adrs.json
```

## Status Normalization

Source repo uses mixed-case status values. Atlas uses lowercase canonical statuses:

| Source Status | Atlas Status |
|---|---|
| Draft | `proposed` |
| Proposal, Proposed | `proposed` |
| In Progress | `proposed` |
| Accepted | `accepted` |
| Approved | `accepted` |
| Done | `accepted` |
| Updated | `accepted` |
| Implemented | `accepted` |
| DEPRECATED, Deprecated | `deprecated` |
| Superseded by ADR#### | `superseded` |
| Rejected | `rejected` |

## QAS Template for New ADRs

```typescript
import { adr, type QASArchitecture } from "@quattio/qas-model";

const adr_NNNN = adr("adr-NNNN")
  .number(N)
  .title("Title from source metadata")
  .status("normalized-status")
  .date("YYYY-MM-DD")
  .authors(["Author Name"])
  .labels(["label1", "label2"])
  .context(`Brief summary of the ADR context and purpose.`)
  // Optional enrichments (can be added later via /generate-adr-qas):
  // .affectsRuntimes(["quatt-api", "quatt-worker"])
  // .affectsDevices(["cic", "odu"])
  // .affectsContracts(["cic-mqtt"])
  // .relatedTo(["adr-XXXX"])
  // .aiContext(["Key insight 1", "Key insight 2"])
  .markdownPath("architecture/adrs/NNNN-kebab-title/adr.md")
  .markdownUrl("https://github.com/Quattio/architectural-decisions/blob/main/docs/decisions/ADRNNNN-kebab-title.md")
  .build();

const architecture: QASArchitecture = {
  entities: [adr_NNNN],
  relationships: [],
};

export default architecture;
```

## Import Script (Batch Sync)

For bulk syncing, use the import script:

```bash
bun run scripts/import-adrs.ts
```

**Warning:** This overwrites existing `qas.ts` files, removing manual enrichments (aiContext, affected systems, workflows). Only use for initial import or when you want to reset to auto-generated state.

For incremental updates that preserve manual enrichments, follow the manual sync process above.

## Numbering Gotchas

- Source repo has a duplicate ADR0015 (firmware update AND dynamic pricing backend) — Atlas maps the dynamic pricing one to `0032-dynamic-pricing-backend`
- Source repo ADR0022.1 is a sub-version — Atlas tracks it as `99999-home-battery-communication` (superseded by ADR0037)
- Atlas has ADRs >= 0042 that were created natively in Atlas (not from the source repo)
- Always verify the ADR number matches between source filename and Atlas directory name

## Quick Verification

After syncing, verify the count:

```bash
# Count source ADRs
ls architecture/repositories/architectural-decisions/repo/docs/decisions/ADR*.md | wc -l

# Count Atlas ADRs
ls -d architecture/adrs/*/  | wc -l

# Build and validate
bun run scripts/aggregate-qas.ts
bun run bundle:adrs
bunx tsc --noEmit
```

## Exemplar Files

- **Rich QAS** (workflows, aiContext, affects): `architecture/adrs/0039-multi-chill/qas.ts`
- **Minimal QAS**: `architecture/adrs/0035-max-water-temperature/qas.ts`
- **Import script**: `scripts/import-adrs.ts`
