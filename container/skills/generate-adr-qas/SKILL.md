---
name: generate-adr-qas
description: Generate or update the qas.ts architecture entity for an ADR by analyzing its adr.md content. Use when an ADR is created or updated and needs its architecture metadata synced.
argument-hint: <adr-directory-name, e.g. "0039-multi-chill">
---

# Generate ADR QAS: $ARGUMENTS

You are generating or updating the `qas.ts` architecture entity for an ADR directory. The `qas.ts` makes ADRs queryable, cross-referenced, and AI-aware without requiring the ADR author to know anything about QAS or TypeScript.

## Phase 1 — Parse the ADR

Read the ADR markdown file:

```
Read architecture/adrs/$ARGUMENTS/adr.md
```

Extract from the **metadata table** (markdown table near the top):

| Field | Table Key | Notes |
|-------|-----------|-------|
| Title | `Title` | Used for `.title()` |
| Status | `Status` | Map: `Draft`/`DRAFT`/`Proposal` → `"proposed"`, `Approved`/`Accepted`/`Done`/`ACCEPTED` → `"accepted"`, `Deprecated` → `"deprecated"`, `Superseded` → `"superseded"`, `Rejected` → `"rejected"` |
| Date | `Date` or `Updated` | Format: `YYYY-MM-DD` |
| Number | `Decision #` | Extract digits from e.g. `ADR0037` → `37` |
| Authors | `Author(s)` or `Owner` | Comma-separated names |
| Labels | `Label(s)` | Comma-separated |
| Stakeholders | `Stakeholder(s)` | Not used in qas.ts but useful for aiContext |

Extract from **prose content**:
- **Context** — From the "Context" section or "Overview > Context". Summarize in 1-3 sentences for `.context()`.
- **Decision** — From "Design Proposal" or "Decision" section. Summarize the key decision in 1-3 sentences for `.decision()`.
- **Mermaid diagrams** — Find all ` ```mermaid ` blocks that contain `sequenceDiagram`. These will become QAS workflow entities.
- **ADR references** — Find mentions of `ADR####` or `adr-####` patterns for `.relatedTo()`.

## Phase 2 — Discover Architecture Entities

Search for entity IDs referenced in the ADR content. Use the atlas CLI to verify IDs exist:

```bash
# Search for entities mentioned in the ADR
bun run atlas query:arch:search --query=<keyword>

# Verify a specific entity ID
bun run atlas query:arch:entity --id=<entity-id>

# List ADRs to verify related ADR IDs
bun run atlas query:adrs:list
```

**Common entity IDs for mapping:**

| Category | Common IDs |
|----------|-----------|
| Runtimes | `quatt-api`, `quatt-worker`, `quatt-timeworker`, `customer-app`, `installer-app`, `support-dashboard`, `boss-backend`, `boss-deal-api`, `dagster` |
| Devices | `cic`, `odu`, `chill`, `heat-charger`, `heat-battery`, `home-battery`, `dongle` |
| Capabilities | `hybrid-heating`, `chill-mode`, `thread-mesh`, `vpp` |
| Contracts | `cic-mqtt` |

Only include entity IDs that are **actually mentioned or clearly relevant** in the ADR content. Do not speculatively add entities.

## Phase 3 — Generate/Update `qas.ts`

### If `qas.ts` already exists

Read the existing file and update it:
- Update metadata fields (status, date, authors, labels) to match adr.md
- Re-analyze content for affected systems, adding new ones found
- Preserve manually added content that is still accurate (custom workflows, aiContext entries)
- Remove references that are no longer accurate

### If `qas.ts` does not exist

Generate from scratch using the pattern below.

### Builder API Reference

The QAS ADR builder is imported from `@quattio/qas-model`:

```typescript
import { adr, workflow, step, type QASArchitecture } from "@quattio/qas-model";
```

**ADR builder methods** (chain in this order):

```typescript
adr("adr-NNNN")                              // Entity ID (adr- prefix + zero-padded number)
  .number(N)                                   // ADR number as integer
  .title("Title")                              // From metadata table
  .status("proposed")                          // lowercase: proposed, accepted, deprecated, superseded, rejected
  .date("YYYY-MM-DD")                          // From metadata table
  .authors(["Name 1", "Name 2"])               // From metadata table
  .labels(["label1", "label2"])                // From metadata table
  .context(`Summary of context...`)            // 1-3 sentence summary from Context section
  .decision(`Summary of key decision...`)      // 1-3 sentence summary from Design Proposal
  .affectsRuntimes(["quatt-api", "quatt-worker"])   // Runtime entity IDs
  .affectsDevices(["cic", "chill"])                 // Device entity IDs
  .affectsCapabilities(["chill-mode"])              // Capability entity IDs
  .affectsContracts(["cic-mqtt"])                   // Contract entity IDs
  .relatedTo(["adr-0025", "adr-0026"])             // Related ADR entity IDs
  .supersedes(["adr-0010"])                         // If this ADR supersedes others
  .supersededByAdr("adr-0050")                      // If superseded by another
  .implementationStatus("not-started")              // not-started, in-progress, completed
  .hasWorkflows(["adr-NNNN-flow-name"])             // Workflow entity IDs defined above
  .aiContext([                                       // 3-8 bullet points for AI agents
    "Key constraint or decision point",
    "Non-obvious detail about the implementation",
    "Important gotcha or caveat",
  ])
  .markdownPath("architecture/adrs/$ARGUMENTS/adr.md")
  .markdownUrl("https://github.com/Quattio/architectural-decisions/blob/main/docs/decisions/ADRNNNN-kebab-title.md")
  .build();
```

**Workflow builder** (for mermaid sequence diagrams):

```typescript
const flowName = workflow("adr-NNNN-flow-name")
  .name("Human-Readable Flow Name")
  .dataFlow()                                   // Flow type
  .active()                                     // Status
  .governedBy("adr-NNNN")                      // Link to parent ADR
  .addStep(
    step("step-1")
      .sequence(1)
      .from("entity-id")                        // Source entity (use architecture entity IDs)
      .to("entity-id")                          // Target entity
      .doing("Description of what happens")     // Action description
      .build()
  )
  // ... more steps
  .build();
```

### File Structure Template

```typescript
import { adr, workflow, step, type QASArchitecture } from "@quattio/qas-model";

// =============================================================================
// Workflows extracted from ADR mermaid diagrams
// =============================================================================

// (Only include this section if the ADR has mermaid sequenceDiagram blocks)

const someFlow = workflow("adr-NNNN-flow-name")
  .name("Flow Name")
  .dataFlow()
  .active()
  .governedBy("adr-NNNN")
  .addStep(/* ... */)
  .build();

// =============================================================================
// ADR Definition
// =============================================================================

const adr_NNNN = adr("adr-NNNN")
  .number(N)
  .title("Title")
  .status("proposed")
  .date("YYYY-MM-DD")
  .authors(["Author Name"])
  .labels(["label1", "label2"])
  .context(`Context summary...`)
  .decision(`Decision summary...`)
  .affectsRuntimes([/* ... */])
  .affectsDevices([/* ... */])
  .affectsCapabilities([/* ... */])
  .affectsContracts([/* ... */])
  .relatedTo([/* ... */])
  .hasWorkflows([/* ... */])
  .aiContext([/* ... */])
  .markdownPath("architecture/adrs/$ARGUMENTS/adr.md")
  .markdownUrl("https://github.com/Quattio/architectural-decisions/blob/main/docs/decisions/ADRNNNN-kebab-title.md")
  .build();

// =============================================================================
// Architecture Export
// =============================================================================

const architecture: QASArchitecture = {
  entities: [adr_NNNN, /* workflows if any */],
  relationships: [],
};

export default architecture;
```

### Key Examples to Study

Before generating, read these exemplar files for patterns:

- **Rich example** (workflows, affects, aiContext): `architecture/adrs/0039-multi-chill/qas.ts`
- **Minimal example** (bare minimum fields): `architecture/adrs/0032-dynamic-pricing-backend/qas.ts`
- **Workflow extraction** (mermaid → workflow steps): `architecture/adrs/0022-cic-chill-communication/qas.ts`

### aiContext Guidelines

Write 3-8 concise bullet points that help an AI agent understand key decisions. Focus on:
- Non-obvious constraints or limits (e.g., "max 2 Chills active due to 800 L/h flow rate")
- Important design choices (e.g., "prioritization uses temperature delta")
- Common misconceptions to avoid
- Cross-system implications
- Key technical parameters

Do NOT include generic statements like "This ADR documents..." — only include actionable context.

### Mermaid Diagram Extraction Rules

When converting mermaid `sequenceDiagram` blocks to QAS workflows:

1. Each `sequenceDiagram` block becomes one workflow entity
2. Map participant names to architecture entity IDs where possible:
   - `CIC` / `CiC` / `Controller` → `cic`
   - `Cloud` / `API` / `Quatt API` → `quatt-api`
   - `Worker` / `Quatt Worker` → `quatt-worker`
   - `App` / `Customer App` → `customer-app`
   - `Chill` → `chill`
   - `ODU` → `odu`
   - `Redis` → `redis`
3. Each arrow (`->>`, `-->>`, `->`) becomes a `step()` with sequential numbering
4. The arrow label becomes the `.doing()` description
5. If a participant name doesn't map to a known entity, use it as-is (it may be an internal component)

## Phase 4 — Validate

After writing the `qas.ts` file, run validation:

```bash
bun run bundle:adrs
```

If it fails:
1. Read the error output
2. Fix the issue in `qas.ts`
3. Re-run `bun run bundle:adrs`
4. Repeat until it passes

Also run a type check:

```bash
bunx tsc --noEmit
```

If there are type errors in the generated file, fix them and re-validate.

## Output

After successful generation and validation, summarize:
- What metadata was extracted
- Which affected systems were identified
- How many workflows were extracted (if any)
- How many aiContext entries were generated
- Validation result (pass/fail)
