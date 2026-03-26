---
name: product-engineering-framework
version: 0.1.0
description: Reference for Quatt's V-Scrum product engineering framework — roles (PdM, STPL, FO, HoD, System Tester, PjM), artifact chain (PRD → System Requirements → Architecture → SW Requirements → ADR → Component Design → Implementation), verification/validation process, meeting cadence, and feature scalability categories. Use when asked about how Quatt develops products, who owns what, what artifacts are needed, or how features move through the V-model.
---

# Product Engineering Framework

Quatt's V-Scrum product engineering framework. This skill provides quick-reference context for questions about roles, processes, artifacts, verification, and feature lifecycle.

## When to Use

Use when the user asks about:
- How Quatt develops products or features (the V-Scrum process)
- Roles and responsibilities (PdM, STPL, FO, HoD, System Tester, PjM)
- What artifacts are needed for a feature (PRD, FRD, System Requirements, ADR, etc.)
- The artifact chain and traceability
- Verification and validation steps (component testing, E2E, SW verification, system validation)
- Meeting cadence (Feature Kickoff, Feature Sync, Sprint Planning, etc.)
- Feature categories and scalability (full-cycle, cross-functional SW, domain-specific)
- Product definitions and roadmap structure
- Design reviews and approval gates
- Definition of Ready for tickets

## Quick Reference (Summary)

### What is V-Scrum?

A hybrid development model combining V-Model rigor (systems engineering, traceability, structured verification) with Scrum speed (iterative delivery, autonomy, continuous improvement).

- **Left side of the V:** Define what to build (stakeholder needs → system requirements → system architecture → SW requirements → ADR → component design → implementation)
- **Bottom of the V:** Domain teams implement via Scrum (2-week sprints, parallel execution)
- **Right side of the V:** Verify and validate (component testing → E2E integration → SW verification → system validation → product acceptance → full release)

### Artifact Chain

```
PRD (product) ──→ System Requirements ──→ System Architecture
                                                │
FRD (feature) ──→ Software Requirements ──→ ADR ──→ Component Design ──→ Implementation
```

- **PRD:** Product-level, non-technical. What we're building and why. Owned by PdM.
- **System Requirements:** Technical, testable. What the system shall do. Owned by STPL.
- **System Architecture:** Subsystem decomposition, interfaces, requirements allocation. Owned by STPL.
- **FRD:** Feature-level, non-technical. What a specific feature must achieve. Owned by PdM.
- **Software Requirements:** Technical translation of FRD into SW behavior. Single source of truth for software. Owned by FO.
- **ADR:** Software architecture decisions, components, data flows. Owned by FO + appointed architect.
- **Component Design:** Detailed design per domain. Owned by HoD.

### Roles

| Role | Owns | Key Boundary |
|---|---|---|
| **PdM** (Product Manager) | Problem space, product outcome, PRD, FRD, roadmap, release approval | Does not write technical requirements or manage teams |
| **STPL** (Systems Technical Project Lead) | System coherence, system requirements, system architecture, system validation | Does not own features, sprint scope, or domain execution |
| **FO** (Feature Owner) | Feature lifecycle, SW requirements, cross-domain coordination, SW verification sign-off | Does not manage teams, run sprints, or own system validation |
| **HoD** (Head of Domain) | Domain execution, team capability, component design, component testing, Scrum facilitation | Does not own system/feature requirements or product roadmap |
| **System Tester** | E2E integration testing, SW verification execution (dynamically assigned per feature) | Does not own component testing, requirements, or validation sign-off |
| **PjM** (Project Manager) | Delivery coordination, supplier management, risk management (for HW-inclusive initiatives) | Does not own product strategy, technical solutions, or team management |

### Three Feature Categories (Scalability)

1. **Full-cycle:** Impacts system behavior/safety/HW. Full V including system requirements and architecture. Example: Boost mode.
2. **Cross-functional SW:** Spans multiple SW domains, no system-level impact. Needs ADR but skips systems engineering. Example: Self-hosted OTA.
3. **Domain-specific:** Single domain, no cross-domain impact. Straight to domain backlog. Example: C++ migration, bug fixes.

The category is determined at the Feature Kickoff using two questions: (1) Do we need System Requirements and Architecture? (2) Do we need an ADR?

### Meeting Cadence

| Meeting | Owner | Cadence | Purpose |
|---|---|---|---|
| Feature Kickoff | FO | Per feature | Scope, assign FO/System Tester, determine engineering path |
| Feature Sync (Ecosystem) | FOs | Bi-weekly | Align priorities, confirm capacity, negotiate trade-offs |
| Team Refinement | HoD | Weekly | Break down and clarify tickets, confirm priorities |
| Sprint Planning | HoD | Every sprint | Commit to sprint backlog, confirm technical approach |
| Stand-Ups | HoD/delegate | Daily | Progress, blockers, coordination |
| Cross-Functional Feature Alignment | FO | Bi-weekly | Cross-domain progress, dependencies, risks (face to face) |
| SW Ecosystem Process Working Session | Head of Embedded | Bi-weekly | Process gaps, continuous improvement |

### Verification and Validation (right side of V)

1. **Component Testing** — Domain-level. HoD accountable. Unit + component + interface contract tests.
2. **Feature Integration Test (E2E)** — First time all blocks work together. FO accountable, System Tester executes.
3. **SW Verification Test (Ecosystem)** — Requirement-by-requirement across all configurations. FO accountable.
4. **System Validation** — Full system against stakeholder needs in real-world scenarios. STPL accountable.
5. **Product Acceptance** — STPL + PdM jointly sign off based on Beta results.
6. **Full Release** — Staggered rollout: new installs → 25% → 50% → 100%. QRES monitors.

### Products

Products: Heat Pump, All-E, Chill, Battery, EnergyOS, Energy Contracts. Enabling products: App, CiC, Dongle. SW features are not products.

Roadmap is outcome- and capability-driven, not a feature list.

## Full Reference

For detailed information on any topic, read the full reference document:

```
Read .claude/skills/product-engineering-framework/product_engineering_framework.md
```

Relevant sections by topic:
- **Left side of V / artifact chain:** Lines 62–174
- **Feature-level work packages (FRD, SW Requirements, ADR, Component Design, Implementation):** Lines 175–334
- **Scrum in V-Scrum / meeting cadence:** Lines 336–405
- **Right side of V / verification and validation:** Lines 407–540
- **Feature scalability categories:** Lines 542–580
- **Roles and responsibilities (all roles with full details):** Lines 582–770
- **Products and roadmap:** Lines 772–870
- **Documentation and tooling:** Lines 872–912
- **Open items and unresolved questions:** Lines 914–end
