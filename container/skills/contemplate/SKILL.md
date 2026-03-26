---
name: contemplate
version: 0.1.0
description: Deep preparatory thinking before generating ideas or making architectural decisions
---

# Contemplate Skill

Structured deep thinking about the platform, its trajectory, and emergent opportunities. This skill is a preparatory phase — it produces understanding, not artifacts. Use it before generating ideas, planning architectural changes, or making design decisions.

## When to Use

- **Before `/ideas`** — to ground idea generation in deep systemic understanding
- **Before architectural decisions** — to ensure you've traced the full impact chain
- **Before cross-domain work** — to understand how systems connect before changing them
- **When explicitly asked** to "think deeply", "consider", "reflect", or "contemplate"

## The Contemplation Process

### Phase 1: Orient (What exists now?)

Survey the current state of the relevant domain. Don't just read — understand the shape.

```bash
# Get the full architecture overview
bun run atlas query:overview

# Search for entities in the domain you're thinking about
bun run atlas query:arch:search --query="<domain>"

# Trace dependencies to understand blast radius
bun run atlas query:arch:deps --id="<entity>" --direction=both
```

Use MCP tools for deeper exploration:
- `search_entities` — find everything related to your thinking domain
- `get_dependencies` — trace connection chains
- `trace_data_flow` — understand how data moves through systems
- `get_ai_context` — read what other agents/sessions have learned

**Key questions:**
- What entities exist in this space?
- How are they connected?
- What teams own them?
- What ADRs constrain them?
- What workflows pass through them?

### Phase 2: Interrogate (What's true? What's assumed?)

Challenge your understanding. Look for gaps between the model and reality.

```bash
# Check if entities have rich aiContext or are thin stubs
bun run atlas query:arch:entity --id="<entity>"

# Look at actual code in repositories
# (read CLAUDE.md, trace imports, check tests)
```

**Key questions:**
- Where does the model say one thing but reality might be different?
- What entities are thin (missing aiContext, missing relationships)?
- What workflows exist in practice but aren't modeled?
- What dependencies exist in code but not in the graph?
- What has changed recently that the model hasn't caught up with?

### Phase 3: Project (Where is this going?)

Think forward. Consider trajectories, not just current state.

**Key questions:**
- What capability is being built next? What will it need?
- What pain points keep recurring? What would eliminate them structurally?
- What's manual today that could be automated?
- What knowledge lives only in people's heads and should be in the graph?
- What would a new engineer (or agent) struggle with? That's a gap.
- If this system scales 10x, what breaks first?
- What's the same shape in different domains? (Patterns are opportunities for abstraction)

### Phase 4: Synthesize (What's the insight?)

This is where contemplation produces value. Connect the dots.

**Key questions:**
- What single change would create the most leverage?
- What's the relationship between the gaps you found?
- Is there a unifying principle behind the patterns you noticed?
- What would you build if you had infinite time? Now: what's the smallest version of that?
- What's the meta-insight — not just what to build, but what kind of thing is missing?

## Depth Levels

### Quick Contemplation (2-3 minutes)
- Read 3-5 relevant entities
- Check their dependencies
- Identify one gap or opportunity
- Suitable for: small ideas, incremental improvements

### Standard Contemplation (5-10 minutes)
- Survey an entire domain (all entities of a type, or all entities for a team)
- Trace 2-3 data flows end-to-end
- Read relevant ADRs and their relationships
- Cross-reference with repository code
- Suitable for: feature ideas, architectural observations

### Deep Contemplation (10-20 minutes)
- Full cross-domain survey
- Read multiple workflows and trace their intersections
- Explore 2-3 repositories for ground truth
- Review the ideas backlog for related thinking
- Consider organizational impact (teams, skills, processes)
- Suitable for: platform evolution ideas, paradigm shifts, new entity types

## Output

Contemplation doesn't produce files — it produces readiness. After contemplating, you should be able to articulate:

1. **What you explored** — which entities, workflows, repos, ADRs
2. **What you found** — gaps, patterns, contradictions, opportunities
3. **What you synthesized** — the insight that connects the observations
4. **What to do about it** — the idea, decision, or action that follows

This naturally feeds into the `/ideas` skill for structured idea generation.

## Anti-Patterns

- **Surface scanning** — reading entity names without understanding relationships. Go deeper.
- **Confirmation bias** — only looking at entities that support a preconceived idea. Explore adjacent domains.
- **Premature closure** — jumping to a solution before Phase 4. Stay in inquiry mode longer than feels comfortable.
- **Isolation** — thinking about one entity without its context. Everything is connected. Trace the edges.

## Integration with Idea Generation

Contemplation is Phase 1 of the Idea Generation workflow:

```
Contemplate (this skill) → Generate Idea (/ideas skill) → Connect to Graph
```

The contemplate skill produces understanding. The ideas skill produces structured entities. Together they ensure ideas are grounded in deep systemic knowledge rather than surface-level reactions.
