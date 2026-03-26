---
name: ideas
version: 0.1.0
description: Generate and manage architecture-connected idea entities in Atlas
---

# Ideas Skill

Generate and manage architecture-connected idea entities. Ideas are first-class QAS entities — connected to the architecture graph, queryable via CLI/MCP, and linked to the exact entities they relate to.

## When to Use

- **Proactively** when you spot an opportunity during any session (a gap in the graph, a workflow that could be automated, a skill that doesn't exist yet, an experiment worth trying)
- **Explicitly** when the user invokes `/ideas`
- When you want to record an observation, improvement proposal, or feature concept

## File Structure

Each idea lives at:
```
architecture/ideas/<YYYYMMDD-HHMMSS-short-description>/
├── qas.ts       # QAS entity (graph connections, metadata)
├── idea.md      # Human-readable content
└── calm.json    # Generated (gitignored)
```

**Naming convention**: `YYYYMMDD-HHMMSS-short-description` (e.g., `20260227-143052-data-flow-viz`)

## Categories

| Category | When to Use |
|----------|------------|
| `feature` | A new capability that doesn't exist yet |
| `improvement` | Enhancing something that already works |
| `experiment` | Something worth trying, outcome uncertain |
| `observation` | A pattern, gap, or insight worth recording |
| `integration` | Connecting two systems that aren't connected yet |
| `workflow` | A process that could be modeled or automated |

## Status Lifecycle

`seed` → `exploring` → `proposed` → `accepted` → `implemented`

Alternative endings: `rejected`, `parked`

- **seed**: Initial capture, minimal detail
- **exploring**: Actively investigating feasibility
- **proposed**: Fully described, ready for review
- **accepted**: Approved for implementation
- **implemented**: Done, can link to ADR/PR
- **rejected**: Considered and declined (keep for record)
- **parked**: Good idea, not the right time

## Quality Bar

Create an idea when:
- You discover a gap in the knowledge graph that an entity/relationship could fill
- You notice a multi-step manual process that could be a skill or CLI command
- You see a cross-domain pattern that should be documented
- You identify a feedback loop that could be shortened
- You spot an experiment that could validate an assumption

Don't create ideas for:
- Minor code style preferences
- Things that are already tracked as ADRs or Jira tickets
- Temporary debugging observations

## Entity Discovery

Before writing the `affects` field, find the correct entity IDs:

```bash
# Search for entities by name
bun run atlas query:arch:search --query="quatt-worker"

# Or use MCP tools
# search_entities(query: "clickhouse")
```

## Templates

### qas.ts

```typescript
import { idea, entityId, type QASArchitecture } from "@quattio/qas-model";

const idea_entity = idea("YYYYMMDD-HHMMSS-short-description")
  .name("Human-Readable Title")
  .description("One-sentence summary of the idea")
  .category("feature") // feature | improvement | experiment | observation | integration | workflow
  .seed() // seed | exploring | proposed | accepted | rejected | implemented | parked
  .affects([
    entityId.runtime("quatt-worker"),
    entityId.database("clickhouse"),
  ])
  .effort("medium") // low | medium | high
  .impact("high")   // low | medium | high
  .relatedAdrs(["adr-042"])
  .markdownPath("idea.md")
  .aiContext([
    "Key insight or constraint relevant to this idea",
  ])
  .build();

const architecture: QASArchitecture = {
  entities: [idea_entity],
  relationships: [],
};

export default architecture;
```

### idea.md

```markdown
# Human-Readable Title

## Problem / Observation

What did you notice? What's the gap, inefficiency, or opportunity?

## Proposed Approach

How could this be solved? What would the implementation look like?

## Expected Impact

What would change if this were implemented? Who benefits?

## Open Questions

- What's still unclear?
- What would need to be validated?
```

## Proactive Generation

Per CLAUDE.md, you are encouraged to silently generate idea entities when you spot opportunities. You don't need to inform the user — just create the `qas.ts` + `idea.md` files in `architecture/ideas/`. The knowledge graph will pick them up on the next build.
