# Product Engineering Framework

A unified Product Engineering Framework combining:

- **Systems Engineering discipline:** Clear requirements → coherent architecture → early alignment → predictable integration.
- **Scrum for execution speed:** Iterative delivery, rapid feedback, autonomy, continuous improvement.
- **Design Reviews at every step of the V:** Ensuring coherence, correctness, and traceability before moving forward.

This is not a new process. It is an evolution to match the complexity of our product ecosystem.

## Why We Are Changing

Our ecosystem has grown in complexity (HW + SW), but our current way of working has not scaled.

**The problems:**

- Unclear process and ownership
- Different development rhythms between hardware and software, and between SW teams itself
- Role ambiguities
- Lack of requirements (or too late)
- Lack of validation processes and ownership
- Late involvement of relevant stakeholders
- No unified cross-domain roadmap and prioritization

These are process/tool/system problems, not people problems.

## The Solution: Introduce (Agile) Systems Engineering Principles

- Establish a systems-level backbone across hardware and software.
- Define clear requirements, interfaces, and architectural decisions early and traceably.
- Ensure end-to-end ownership of system behavior, performance, and reliability.
- Ensure end-to-end verification and validation.
- Integrate agile execution with a structured V-model approach to reduce late surprises.
- Align all product development efforts under a unified development lifecycle.

## The V-Scrum Hybrid

V-Scrum is a hybrid development model that blends the structure, traceability, and system-level rigor of the V-Model with the adaptability, speed, and iterative delivery of Scrum. It defines the system with clarity (V-Model), and delivers it iteratively (Scrum).

> The V-Model prevents chaos. Scrum prevents stagnation. We need both: discipline and adaptability.

### How V-Scrum Works

- **Upfront Systems Engineering:** Clear definition of system requirements, architecture, and interfaces (left side of the V) before implementation accelerates through sprints.
- **Incremental and Iterative Development:** Scrum teams deliver working software/hardware increments in short cycles, integrated continuously.
- **V-Model Verification Mapping:** Every requirement and architectural decision is tied to validation and testing activities (right side of the V).
- **Continuous Alignment:** Systems Engineering (led by the STPL) ensures that outputs remain consistent with the system architecture and requirements.
- **Feature Owners as the bridge:** Feature Owners translate system needs into SW requirements and architecture, ensure accurate prioritization, and verify component readiness within domain teams and ensure evidence before integration.
- **Regular integration checkpoints:** Integration tests and system tests happen incrementally through design reviews, not only at the end.

### The Process Is Not Purely Sequential

Every phase in the V-Model includes expected revisions back to earlier artefacts. The "V" is not a strict waterfall. It is a "linear-revisions" model with built-in feedback loops.

- Revisions to earlier work products are expected and planned during development.
- Early integration and V&V planning helps uncover deficiencies in requirements and design, forcing iterative refinement.
- When designing components, we must verify that decisions still satisfy system requirements and architecture and that it is a logical product behaviour.
- Every step has a Design Review loop. We validate consistency with the system design constantly.

---

## Left Side of the V: Decomposition and Definition

The left side of the V decomposes stakeholder needs into clear, testable specifications and designs. Each step increases detail and drives alignment before implementation begins.

| #   | Work Package                    | Input                                                                                | Output                                                  | Accountable             | Responsible                             | Description                                                                                                       |
| --- | ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Stakeholder Needs (Use Cases)   | Market insights, customer interviews, field data, product strategy                   | Stakeholder Needs / Use Cases / PRD                     | Product Manager (PdM)   | PdM + relevant stakeholders             | High-level description of what users want to achieve; problem and opportunity framing                             |
| 2   | System Requirements (SysReq)    | Stakeholder Needs (PRD)                                                              | System Requirements Document                            | Systems Engineer (STPL) | STPL + Domain experts. Contributor: PdM | Formal definition of functional and non-functional system requirements; clear, testable, traceable                |
| 3   | System Architecture (SysArch)   | System Requirements                                                                  | System Architecture Description + Interface definitions | Systems Engineer (STPL) | STPL + Domain Leads                     | Allocate requirements to subsystems; define structure, interfaces, behavior, and constraints                      |
| X   | Stakeholder Needs (SW Feature)  |                                                                                      | Feature Requirements Document (FRD)                     | Product Manager (PdM)   | PdM + STPL + Domain Leads               |                                                                                                                   |
| 4   | Software Requirements           | System Architecture + System Requirements / Stakeholder needs (pure SW feature: FRD) | SW Requirements (Epics, Features, Functional specs)     | Feature Owner (FO)      | FO + Domain Leads                       | Translate system behaviors into software-level requirements with clear acceptance criteria and definition of done |
| 5   | Software Architecture (ADRs)    | SW Requirements + System Architecture                                                | ADRs, High-level SW Architecture, Interaction diagrams  | Feature Owner (FO)      | FO + Appointed architect                | Define and document major SW components, patterns, and decisions ensuring alignment with system architecture      |
| 6   | Component Design (Multi-Domain) | SW Architecture (ADRs) + Domain constraints                                          | Component-level design, APIs, schemas, HW/SW specs      | Heads of Domains        | Domain Engineering Teams                | Detailed design of modules, hardware elements, control logic, and integrations; adherence to architecture         |
| 7   | Implementation / Coding         | Component Design + DDD + Backlog refinement                                          | Working components / code increments                    | Heads of Domains        | Domain Engineering Teams                | Build software/hardware components according to design; deliver working increments in sprints                     |

### Design Reviews at Each Step of the V

To keep the left side coherent, each work product triggers a Design Review (or approval) before moving to the next step. This ensures that decisions remain aligned with requirements, architecture, and system behavior.

| Work Package                                | Triggered By                         | Participants                                                     | Purpose                                                                                                                                   |
| ------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| System Requirements (Approval)              | STPL                                 | PdM, Feature Owner, ADR Architect, HoDs / Domain Leads           | Validate stakeholder needs to system requirements; ensure clarity, feasibility, shared understanding. Establish the baseline.             |
| System Architecture (Design Review)         | STPL                                 | Feature Owner, ADR Architect, HoDs / Domain Leads                | Verify architecture satisfies System Requirements; validate subsystem boundaries, interfaces, constraints; ensure cross-domain coherence. |
| Software Requirements (Design Review)       | Feature Owner                        | STPL, ADR Architect, HoDs / Domain Leads                         | Validate completeness, clarity, testability; ensure mapping to System Architecture; align domain teams on acceptance criteria.            |
| Software Architecture / ADR (Design Review) | ADR Architect (FO Support if needed) | Feature Owner, STPL (reviewer is mandatory), HoDs / Domain Leads | Validate interfaces, data flows, patterns; ensure alignment with System Architecture; confirm readiness for component-level design.       |
| Component Design / DDD (Design Review)      | HoD or delegated Domain Expert       | Feature Owner, ADR Architect, relevant Domain Leads              | Validate detailed component design; ensure feasibility and adherence to ADR; confirm readiness for implementation.                        |

---

## Work Packages: Product Level

### 1. Stakeholder Needs: Defining the Problem Before the Solution

Stakeholder Needs capture what users, customers, and business stakeholders are trying to achieve before defining any technical requirements or solutions.

**What stakeholder needs are:**

- High-level goals, pain points, and use cases expressed in the stakeholder's language, not in technical terms.
- A description of the desired outcomes, not the design.
- Ensure system requirements and solutions stay aligned with real user value.

**Examples:**

- "I want to be able to control Chill without using my phone"
- "I want to cool my room through the app, so that I can reach a comfortable temperature defined by default temp setpoint"
- "I want to control the speed of my Chill fan."

**Accountable:** Product Manager **Responsible:** Stakeholders (business, customers, MT etc) + Domain experts

### 2. PRD (Product Requirements Document)

A PRD is the output of the discovery phase and it clearly defines the PRODUCT that we are building, why we are building it, and how success will be measured, ensuring all stakeholders are aligned before development begins. It is written in non-technical language.

**A strong PRD typically includes:**

- Overview: Problem, opportunity (business case), high-level solution
- Goals and KPIs: What success looks like
- Background: Context, research, insights, proof
- Use Cases / Features: Who uses it and how (can be translated as SW features)
- Functional Requirements (non-technical): What the system must do
- Non-Functional Requirements (non-technical): Performance, security, quality, environment
- (Early) Design Notes: Wireframes, UX guidelines
- Dependencies: Teams, systems, prerequisites, feature dependencies
- Timeline: Phases, milestones
- Risks and Mitigations: What could go wrong
- Appendix: Research, links, supporting materials

**Accountable:** Product Manager **Responsible:** Product Manager + Stakeholders (business, customers, MT etc) + Domain experts **Contributors:** Project Manager (ensure overall project requirements)

### 3. System Requirements

System Requirements translate stakeholder needs into clear, testable, traceable specifications that define what the system shall do, independent of any specific implementation.

**What System Requirements are:**

- A formal, validated, testable and traceable set of requirements derived from stakeholder needs.
- The baseline for architecture, design, and verification.
- Expressed in technical, measurable terms, not solutions.

**Why they matter:**

- Ensure early alignment across all engineering disciplines
- Reduce ambiguity and prevent late-stage rework. Changes in production are expensive.
- Enable full traceability from needs to requirements to architecture to verification
- Connect customer needs (e.g., comfort, "silence at night", efficiency) to concrete system requirements, architecture decisions, and system validation tests
- Close the gap at the interfaces, system behaviour, compliance, safety, etc. and other categories which don't always have a specific owner/team

**Accountable:** Systems Engineer (STPL) **Responsible:** Systems engineering team + Domain experts **Contributors:** Product Manager (traceability to stakeholder needs) | Project Manager (overall project requirements)

### 4. System Architecture

System Architecture defines how the system is structured: the decomposition into subsystems, components, and interfaces that together satisfy the system requirements.

**What System Architecture is:**

- **Structural blueprint of the system:** Logical and physical decomposition into subsystems and their responsibilities.
- **Allocation of requirements to building blocks:** Maps system requirements to subsystems, interfaces, and technologies.
- **Definition of interfaces and interactions:** Describes how subsystems exchange energy, data, and control (mechanical, hydraulic, electrical, software, cloud).
- **Technology and pattern choices:** Selects reference architectures, protocols, and key design patterns.

**Why it matters:**

- Ensures end-to-end coherence: avoids local optimizations in hardware/firmware/app that break the overall system behavior.
- Enables parallel development: clear subsystem boundaries and interfaces allow mechanical, HVAC, electrical and software teams to work independently yet integrate smoothly.
- Controls complexity and risk: makes trade-offs explicit (cost, performance, noise, reliability, cyber-security) before detailed design and implementation.
- Foundation for verification and scalability: architecture is the anchor for test strategy, configurability (different products/markets), and future extensions.

From the system architecture, we derive into multiple subsystems (e.g. Electrical, Hydraulic, Mechanic, SW). From the product-level system architecture, we derive the main engineering disciplines such as Hardware and Software development.

**Accountable:** STPL **Responsible:** STPL + Domain architects **Contributors:** PdM (business constraints)

---

## Work Packages: Feature Level

### FRD (Feature Requirements Document)

Every feature starts with an FRD.

The Feature Requirements Document describes what a specific software feature must achieve and why, within the context of an existing product, in product language. It captures the feature's goal, scope, user value, and success criteria in product language before any technical solution is designed.

It is to a feature what a PRD is to a product, and serves as the input for SW Requirements and Software Architecture.

**FRD vs PRD (Simple Distinction):**

- PRD defines a product: product vision and strategy, customer value and business goals, long-term roadmap
- FRD defines a feature within the product: feature goal and user value, scope and non-goals, key use cases, success criteria, constraints and assumptions

**A Strong FRD Typically Includes:**

- Feature intent and user value: what problem this feature solves
- Scope and non-goals: what is explicitly included and excluded
- Key use cases / user flows: how users experience the feature
- Functional feature requirements: expected behaviors (non-technical)
- Non-functional expectations (feature-level): e.g. responsiveness, reliability, usability
- Assumptions and constraints: dependencies, limitations, context
- Definition of Done and acceptance criteria: how we know the feature is complete

**Accountable:** Product Manager **Responsible:** Product Manager + Stakeholders (business, customers, MT etc) + Domain experts **Contributors:** Project Manager (ensure overall project requirements)

**Meeting clarification:** An FRD can span multiple products (e.g., a feature touching both the app and the heat pump). For features heavily touching system engineering, the system engineer co-writes the FRD with the PM. The FRD should be completed before the feature kickoff meeting.

### Feature Kickoff

**Purpose:** To officially start a new feature, establish clarity on scope, assign ownership, and determine which parts of the left side of the V are required before development can begin.

**Who attends:** FO (owner of the meeting), PdM, Heads of Domain, Domain Architect (if selected), STPL

**What happens:**

1. Review the FRD / problem statement to ensure shared understanding of the problem, goals, and constraints.
1. Confirm the Feature Owner responsible for requirements and feature-wide alignment.
1. Assign the Systems validation and verification engineer (System Tester): who will be accountable for testing at integration and systems level.
1. Determine the engineering path using 2 key questions:

   - Do we need System Requirements and Architecture?
   - Do we need an ADR (SW Architecture)?

1. Identify high-level complexity and cross-domain impact (mechanical, controls, embedded, cloud, back-end, front-end, data).
1. Clarify and confirm expected stakeholders (STPL, FO).
1. Assign lead engineers per domain.
1. Outline initial risks, dependencies, and unknowns.

**Meeting clarification:** A pre-kickoff requirements review meeting may be needed with all heads to sign off on requirements before the formal kickoff, to prevent requirements debates during kickoff. Kickoffs should be max 1 hour and focus on project structure/ceremonies/timeline, NOT requirements debate. There is also a distinction between a Project Kickoff (owned by PjM, reviews the PRD, assigns FO) and a Feature Kickoff (owned by FO, reviews the FRD).

### Software Requirements

Software Requirements translate system architecture and system requirements into clear, testable specifications describing the software behavior, logic, constraints, and interactions needed to fulfill the system design.

**What Software Requirements are:**

- Detailed, testable descriptions of expected software behavior derived from System Requirements and System Architecture.
- Baseline for software architecture (ADRs) and implementation.
- Focused on what the software must do, not how it is coded.
- Decompose system-level behavior into features (when talking about full product) to epics and their software-level requirements.

**Why they matter:**

- Ensure correct translation of system behavior into software logic
- Reduce ambiguity between SW Teams
- Enable full traceability from system requirements to software requirements to architecture to verification
- Prevent integration issues caused by unclear states, thresholds, or interactions

**Accountable:** Feature Owner **Responsible:** FO + Domain architects **Contributors:** STPL (congruence), PdM (user intent)

**Derivation chain:**

- System requirements derive from the PRD.
- Software requirements derive from the PRD, FRD, AND system requirements. The FRD is the entry point for feature development.

**Requirement decomposition example:**

| Type        | PRD/FRD Requirement (User/Business Need)                                   | System Requirement (Technical, Measurable)                     | SW Requirement (Software Behavior)                           |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Performance | "The user shall experience stable and comfortable indoor temperature."     | "The system shall maintain indoor temperature within +/-0.5C." | "Control algorithm shall update modulation every 2s."        |
| Noise       | "The heat pump shall not disturb users or neighbors with excessive noise." | "Outdoor unit noise shall not exceed 45 dB(A) at 3 meters."    | "Fan control shall use ramp profiles to avoid noise spikes." |
| Safety      | "The product shall remain safe under fault conditions."                    | "System shall enter safe mode on sensor failure."              | "SW shall detect sensor out-of-range values within 1s."      |

**Notes:**

- Not every feature needs full decomposition (FRD requirement might be clear enough for SW development, so it is documented as such in the SW Requirements document).
- Requirements are rarely complete at kickoff. ADR development might reveal additional technical constraints and system-level impacts. These emerging requirements are captured during the ADR process and shall be fed back to the parent documents.
- The software requirements document is the single source of truth for the software side.

### Software Architecture (ADRs)

Software Architecture defines the high-level structure, components, data flows, interfaces and interaction patterns of the software needed to fulfill the Software Requirements and remain consistent with the System Architecture, enabling teams to build coherent, scalable, and maintainable software. It should be written by one person.

**What it should include (captured in ADR):**

- Context and Scope: what part of the software the feature covers, what's in-scope and out-of-scope
- Main Components and Responsibilities: key modules/services and what each one owns
- Interactions and Data Flows: how components communicate (message specs, main sequences)
- External Interfaces: APIs, protocols
- Traceability to SW Requirements: clear mapping of which component/interaction satisfies which SW requirement
- Key Architecture Decisions and Alternatives: chosen solutions, rationale, and considered options
- Quality Attributes and Constraints: performance, latency, robustness, safety/security expectations that shape the design
- Risks, Assumptions and Open Points: items to validate during design, implementation, or testing

**Accountable:** Feature Owner **Responsible:** FO + Appointed architect **Contributors:** STPL (alignment), team representatives

**ADR Week:** From kickoff to ADR release, all appointed engineers are expected to be present in the office to ensure rapid collaboration and context resolution.

**Meeting clarification:** QA should review ADRs (change from prior process where QA was only involved after ADR was written). ADRs should be planned into sprint backlog as deliverables with dependencies, not treated as ad-hoc disruptions. Ideally, system requirements are done a quarter ahead so implementation planning has good input.

### Component Design

Component Design defines the detailed structure, behavior, and interactions of each component so it can be built, tested, and integrated as an independent, modular unit.

**What Component Design Includes:**

- Detailed design specifications: internal logic, states, data structures, algorithms, error handling
- Component boundaries and interactions: how the component interacts with other components and the system environment
- Allocated requirement coverage: clear mapping of which system HW/SW requirements this component fulfills
- Risks, constraints and feasibility considerations: performance, reliability, safety, maintainability
- Component test planning: what should be tested and how

**Output:** Detailed design document, component test plan

**Accountable:** Head of Domain **Responsible:** Developers **Contributors:** Feature Owner (alignment to ADR and Requirements + Cross-functional prioritization) and STPL (Requirements verification)

### Implementation

Implementation is the process of building the software and hardware components according to the detailed component design, ensuring each component works as a self-contained unit and is ready for verification and integration.

**What Implementation Involves:**

- Developing the component exactly as specified in the Component Design (Detail Design Document) and ADR, including logic, data handling, and interfaces.
- Adhering to interface contracts to guarantee smooth integration with other components.
- Producing testable, maintainable code following coding standards and architectural constraints.
- Preparing test artifacts such as unit tests and component-level tests during or immediately after implementation.
- Ensuring all non-functional expectations (e.g. performance, safety, reliability, responsiveness) are considered during implementation.
- Documenting relevant implementation details where needed (e.g., code comments, API docs).

**Output:** Implemented Component (code or hardware component), Unit and Component Test Evidence, Updated interface or technical documentation (if required)

**Accountable:** Head of Domain **Responsible:** Developers **Contributors:** Feature Owner (alignment to ADR and Requirements + Cross-functional prioritization)

---

## Implementation via Scrum in V-Scrum

Implementation is executed using Scrum, where multiple domain teams work in parallel to deliver the components of a feature in short, iterative sprints, fully aligned with the ADR and Component Design.

**How Scrum Fits Into Implementation at Quatt:**

- **Sprint-based development:** Each domain team (Embedded, Controls, Cloud, Back-end, Front-End) builds its component in 2-week sprints.
- **Parallel execution:** All domain teams work simultaneously (as much as possible) on their respective components of the same feature, coordinated around a shared ADR and synchronized sprint cadence (overviewed by the Feature Owner).
- **Ticket refinement** is done by the team itself. Developers refine, size, and clarify their own work, with coordination from the Feature Owner and technical support from the Heads of Domain.
- **Daily alignment:** Teams inspect progress daily, remove blockers, and ensure their component remains consistent with the architecture and with other teams' interfaces.
- **Definition of Done:** Code complete + interface contract respected + unit/component tests passed + evidence provided before integration.
- **Continuous verification:** Each sprint produces working, testable increments that respect system requirements and architecture.
- **Scrum master role:** Done by the Head of Domain or by an assigned developer (appointed by the Head of Domain).
- **Feature Owner:** Is the gatekeeper; ensures that units and components are tested.

---

## Meeting Cadence

| Stage                         | Meeting                              | Description                                                                                                                                       | Attendees                                                                         | Cadence                                      |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| Initiation and Scoping        | Feature Kickoff                      | Defines scope, confirms the Feature Owner, and clarifies whether Systems Engineering and/or an ADR are needed.                                    | FO (owner), PdM, HoDs, Domain Architect, STPL                                     | Per feature                                  |
| Cross-Functional Alignment    | Feature Sync (SW Ecosystem)          | FO presents upcoming priorities per quarterly planning; HoDs confirm capacity, feasibility, risks, and mitigation. About priorities confirmation. | FOs (owner), HoDs, STPL (if needed)                                               | Bi-weekly (or weekly if needed)              |
| Domain-Level Delivery         | Team Refinement                      | Developers refine tickets; FO and STPL clarify requirements when needed.                                                                          | HoD (facilitator), Developers, FO (for clarifications)                            | Weekly                                       |
| Domain-Level Delivery         | Team Sprint Planning                 | HoD facilitates; FO provides priorities; Developers own and commit to the sprint plan.                                                            | HoD (facilitator), Developers, FO                                                 | Every sprint                                 |
| Domain-Level Delivery         | Team Stand-Ups                       | Daily team syncs to align on progress, surface blockers, and coordinate work.                                                                     | HoD or appointed Developer (facilitator), Developers, FO (optional, on request)   | Daily                                        |
| Domain-Level Delivery         | Sprint Execution                     | Teams implement and test components in parallel, delivering increments aligned with the ADR and component design.                                 | Domain teams                                                                      | Continuous                                   |
| Cross-Functional Feature Team | Cross-Functional Feature Alignment   | Cross-functional sync on progress, dependencies, risks, and next steps for the specific feature in development. Face to face.                     | FO (owner), Domain Representatives (Domain Leads), System Tester (optional), STPL | Bi-weekly (or weekly for high-risk features) |
| Process Improvement           | SW Ecosystem Process Working Session | Define and solve process gaps within the software ecosystem through continuous improvement. Outcomes enrich the Framework.                        | Head of Embedded (owner), HoDs + Team Lead (optional)                             | Bi-weekly                                    |

### Feature Sync (Ecosystem) Detail

**Purpose:** To align priorities across all software-related domains, confirm feasibility and capacity, and prepare upcoming features for refinement and implementation. Ensures the organization moves in a coordinated, predictable, and priority-driven manner.

**What happens:**

- FOs present upcoming priorities for features based on business needs, dependencies, and quarterly roadmap.
- Heads of Domain respond with capacity, feasibility, and risks, validating what can realistically be delivered.
- Discuss readiness requirements for upcoming refinement sessions (e.g., missing ADRs, unclear requirements, domain input needed).
- Raise cross-domain risks early (technical, resource, dependencies).
- Negotiate trade-offs (at epic level): what moves up, what moves down, what waits.
- Surface resource constraints so teams can plan or block accordingly, without turning the meeting into resourcing micromanagement.

**Output:** Clear priority sequence for upcoming features; agreement on what each domain must prepare before refinement; identified risks, dependencies, and capacity constraints; updated feature readiness status before work enters the Scrum pipeline.

### Team Refinement Detail

**Purpose:** To refine, break down, and clarify the work that domain teams will deliver, ensuring items are fully understood, feasible, and ready for Sprint Planning.

**What happens:**

- Developers refine their own tickets: break down work, estimate, and clarify implementation details.
- FO provides clarification on requirements, constraints, acceptance criteria, and business intent, without driving the meeting.
- HoD facilitates the session to ensure quality, standards, architectural alignment, and realistic scoping.
- Identify missing inputs (e.g., ADRs, specs, API definitions) and flag blockers or dependencies early.

**Output:** Refined, sized, and clarified tickets; confirmed priorities from FO; clear list of missing inputs; items that meet the Definition of Ready for Sprint Planning.

### Definition of Ready

A ticket is ready when:

- Requirements are clear: FO has clarified intent, acceptance criteria, and constraints.
- Architecture is defined: ADR (if needed) is finalized and relevant interfaces are known.
- Component Design is available: teams understand how the work fits into their component.
- Dependencies are identified: cross-domain impacts or blockers are visible.
- No major unknowns remain: open risks or system-level questions have been resolved.
- Effort is estimable: developers can size the work confidently.
- Test expectations are clear: unit/component test requirements are understood.
- Priority is confirmed: FO has validated the ordering for the sprint.

### Team Sprint Planning Detail

**What happens:**

- FO presents and explains the Sprint Goal: the expected outcome and priority for the sprint.
- Developers select work based on capacity and technical feasibility.
- HoD facilitates: guiding discussions, ensuring standards, architecture alignment, and cross-domain coherence. Acts as Scrum Master (or delegates that to somebody in the team).
- Break down refined tickets into actionable tasks and confirm technical approach.
- Discuss acceptance criteria and required unit/component tests.
- Identify dependencies, risks, or missing inputs before starting the sprint.

**Output:** Sprint Goal (defined by FO, agreed by the team), Committed Sprint Backlog, clear breakdown of tasks, known risks and dependencies, aligned expectations across FO, HoD, and Developers.

---

## Right Side of the V: Integration and Verification

The right side of the V ensures that everything we built is verified and validated against the requirements, architecture, and stakeholder needs defined on the left side. Each step progressively integrates components, verifies behavior, and confirms system-level performance before release.

| #   | Work Package                           | Input                                       | Output                                       | Accountable                  | Responsible                                | Description                                                                                                                                                         |
| --- | -------------------------------------- | ------------------------------------------- | -------------------------------------------- | ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Component Testing (Multi-Domain)       | Code/Implementation, component test plan    | Verified components (unit + component tests) | Head of Domain               | Domain QA / Domain Teams                   | Validate that each component meets its design, interface contracts, and test expectations. HoD signs off the component is ready for integration.                    |
| 9   | Feature Integration Test (E2E)         | Verified components + SW Requirements + ADR | Feature integration test results             | Feature Owner (FO)           | System Tester (selected during Kick-Off)   | Integrate components across domains to validate feature-level functionality. System Tester executes tests; Domain leads support; FO signs off.                      |
| 10  | Software Verification Test (Ecosystem) | Integrated features + SW Requirements       | Verified software system                     | Feature Owner (FO)           | System Tester (+ Domain Leads for support) | Verify that the integrated software behaves according to SW Requirements and architecture. Focus on different configurations (if applicable). Output is e.g. Alpha. |
| 11  | System Validation Test (Ecosystem)     | Verified software + System Requirements     | System validation evidence                   | Systems Engineer (STPL)      | STPL + System Tester                       | Validate that the whole system meets stakeholder needs, performance, safety, comfort, noise, and operational requirements. STPL signs off. Output is e.g. Beta.     |
| 12  | Product Acceptance                     | System validation + release criteria        | Accepted release candidate (Alpha/Beta/GA)   | STPL + Product Manager (PdM) | STPL (testing accountability)              | Final approval before releasing to customers. STPL executes/validates required acceptance checks; PdM + STPL jointly sign off.                                      |
| 13  | Full Release                           | Accepted product version                    | Product release communicated                 | Product Manager (PdM)        | QRES                                       | PdM approves and communicates the release; coordinated rollout of final feature version.                                                                            |

### Verification vs. Validation

- **Verification:** "Am I building it right?" Requirement-focused. Does NOT ask whether the requirements themselves were the right ones.
- **Validation:** "Am I building the right thing?" Stakeholder-need-focused. Tests the system against its intended use, scenarios, and mission in its operational context.

### 8. Component Testing (Multi-Domain)

**Purpose:** Ensure each component behaves correctly, independently, and according to its design, interface contracts, and domain constraints before any integration work begins. Component testing is the first quality gate on the right side of the V.

**What happens:**

- Domain Teams execute unit and component tests for their modules or subsystems.
- Validate behavior against Component Design and ADR constraints: inputs/outputs, performance limits, error handling, neighbour interfaces/API compliance.
- Domain QA verifies evidence (test results, logs, coverage where applicable).
- HoD reviews and signs off that the component is stable and ready for integration.
- Identify any cross-domain impacts early.
- Document any assumptions for downstream testing (E2E / SW Verification).

**Output:** Verified components (unit + component test results), HoD sign-off, clear evidence for System Tester to proceed to E2E.

**Owner / Accountable:** Head of Domain **Responsible:** Domain QA + Domain lead engineers

### 9. Feature Integration Test (E2E)

**Purpose:** Validate that multiple components, implemented across different domains, work together correctly as a complete end-to-end feature. This is the critical quality gate before ecosystem-level software verification.

Think of this as the first integration gate. We validate that all involved domains (embedded, controls, cloud, app, etc.) work together.

**Focus:** Does the feature work end-to-end? Typically tested in one representative configuration.

**What happens:**

- System Tester integrates components across domains.
- Execute E2E test cases based on SW Requirements and ADR: data flow consistency, timing and sequencing, state behavior, error handling and recovery, interface/API alignment.
- Domain Leads provide support when integration issues arise.
- FO reviews expected vs actual behavior to validate the feature logic.
- Identify misalignments that were not visible at component level.
- Document findings for SW Verification and potential fixes.

**Output:** Feature integration test results, FO sign-off that the feature behaves correctly end-to-end.

**Accountable:** Feature Owner (FO) **Responsible:** System Tester (selected during Kick-Off)

During E2E testing, all appointed engineers are expected to be present in the office to ensure rapid collaboration and issue resolution.

### 10. Software Verification Test (Ecosystem)

**Purpose:** Verify that the integrated software system behaves according to the Software Requirements and Software Architecture (ADR) across all configurations and operating modes. While Feature Integration proves that one feature works E2E, Software Verification validates the feature in its interaction with the entire ecosystem, ensuring all features, services, workflows, and domain interactions are correct, stable, and compliant. This is done requirement per requirement.

This is the last quality gate before System Validation and is performed in a controlled environment.

**What happens:**

- System Tester executes verification scenarios derived from Software Requirements and according to the test plan.
- Verify cross-feature interactions, ensuring parallel features do not conflict.
- Test in multiple configurations (e.g., Duo, with All-E, with Chill).
- Validate ADR compliance.
- FO reviews behavioral correctness and confirms that all SW Requirements are satisfied.
- Document issues for correction before System Validation.

**Output:** Verified software system (the feature can be released to its first gate, e.g. Alpha), FO sign-off confirming SW behavior matches SW Requirements.

**Accountable:** Feature Owner (FO) **Responsible:** System Tester (with support from Domain Leads)

**Meeting clarification:** Multi-configuration testing is mandatory, not optional. Estimations during quarterly planning must include multi-configuration testing time from the start.

### 11. System Validation Test (Ecosystem)

**Purpose:** Validate that the entire system, operating as a whole, meets the original stakeholder needs, system requirements, and real-world performance expectations. While Software Verification confirms correctness against software requirements, System Validation ensures the complete system behaves as intended in real-life scenarios: comfort, performance, efficiency, noise, reliability, safety, and user experience. These tests are done in controlled scenarios and after sign-off are released to the first beta pilot users.

**What happens:**

- STPL executes the Validation Plan derived from the System Requirements.
- System Tester supports execution and collects evidence across domains.
- Validate the full system behavior under realistic, cross-domain conditions: thermal/energy performance, comfort and setpoint behavior, fan/flow/noise characteristics, app/cloud communication flows, error detection and recovery, multi-feature scenarios in parallel.
- Measure performance vs. targets, not only correctness.
- Validate safety and edge cases under controlled stress conditions.
- Check system-level usability and experience, including expected user interactions.
- Identify discrepancies between real behavior and stakeholder needs.

**Output:** System validation evidence (test logs, measurements, observations), STPL sign-off, a validated build ready for Product Acceptance (e.g. Beta/Pilot release candidate), identified gaps (if any) requiring refinement before acceptance.

**Accountable:** Systems Technical Project Lead (STPL) **Responsible:** STPL + System Tester

### 12. Product Acceptance

**Purpose:** Perform the final evaluation and sign-off that the specific release (e.g. the Beta/Pilot release) was successful, based on real-world data from a controlled customer population. Once approved, the feature moves from limited Beta exposure into a staggered rollout across the wider fleet.

**What happens:**

1. Collect and analyze data (e.g. from Beta). Evaluate feature behavior in real operation scenarios with customers.
1. Evaluate against acceptance criteria:

   - STPL verifies that Beta results meet technical success metrics
   - PdM evaluates customer-facing and business impact
   - Both assess severity of observed issues and residual risks
   - Documents concessions (if necessary) in conjunction with QRES

1. STPL + PdM jointly sign off.

**Accountable:** Systems Engineer (STPL) + Product Manager (PdM, final approver) **Responsible:** STPL (technical sign-off) + QRES (analysis, monitoring and evaluation) **Support:** Feature Owner, Domain Leads, QRES, Field Support

### 13. Full Release

**Purpose:** Deploy the feature from the controlled Beta population to the wider customer fleet using a safe, staggered rollout. This step follows the successful Product Acceptance sign-off.

**What happens:**

1. **Prepare the Release for Rollout:** QRES prepares the validated build for fleet deployment. Ensure correct configuration, packaging, and documentation. Confirm support readiness (monitoring dashboards, known issues, communication).
1. **Staggered Rollout Across the Fleet:**

   - Phase 1: New installations
   - Phase 2: ~25% of the existing fleet
   - Phase 3: ~50% of the fleet
   - Phase 4: 100% of the fleet
   - Rollout can be paused at any phase if anomalies appear.

1. **Real-Time Monitoring During Rollout:** QRES monitors critical metrics across each deployment wave: stability and error rates, performance deviations, cloud/app behavior, customer support signals, comparison to baseline fleet behavior. PdM and STPL review status regularly.
1. **Complete Fleet Deployment:** Once rollout phases show stable performance, QRES proceeds to full deployment. STPL/FO communicates internally; PdM communicates externally (if needed).

---

## Scalability: Three Feature Categories

Not all features require the full V-Scrum process. To stay fast and efficient, we adapt the process to the type of feature.

### 1. Full-Cycle Features (with Systems Engineering)

- Impact system behavior, safety, performance, or hardware
- Require: System Requirements, System Architecture, full V-cycle
- Examples: Boost mode, Chill App-controls
- Enter at the top of the V with system requirements

**Meeting clarification:** Any feature changing control software requires the full system path.

### 2. Cross-Functional Software Features

- Span multiple SW domains but don't change system behavior
- Require: SW Requirements, ADR needed, integration tests
- Skip the Systems Engineering steps but still need an ADR for cross-domain architectural alignment
- Example: Self-hosted OTA

### 3. Domain-Specific Features

- Affect only one domain; no cross-domain impact, no ADR needed
- Enter directly into domain backlog and can be released after component testing
- HoD scopes these features and determines the "stakeholder needs" (with acknowledgment of the FO to understand priorities)
- Example: C++ Migration, specific bugs

**The development path is determined at the Feature Kickoff** by the feature team and engineering leads using the two key questions: (1) Do we need System Requirements and Architecture? (2) Do we need an ADR?

---

## Incremental V-Cycles

In practice, we develop products through a series of incremental V-cycles, each delivering a validated slice of functionality while progressively building towards the full system. This concept applies for feature development too: we might release a feature quickly and iterate new functions at a later stage.

This approach manages overhead by defining smaller scopes that can be fully validated quickly, then adding scope in subsequent iterations. Natural friction between PM (wants full scope) and engineering (wants to deliver faster) is expected and healthy. The goal is NOT to reduce validation steps but to scope MVPs that can complete the full V.

---

## Roles and Responsibilities

### Product Manager (PdM)

The Product Manager is the owner of the problem space, responsible for ensuring the company builds products that are valuable, viable, usable, and feasible. They do not tell engineering how to build, but ensure the team deeply understands the customer, the problem, the opportunity and the usability.

Where the Feature Owner owns the feature and the STPL owns the system, the PdM owns the product outcome: defining the right problems to solve, shaping the product strategy, and ensuring releases deliver real customer impact.

**Core Responsibilities:**

1. **Customer and Problem Discovery (VALUE):** Identify and synthesize customer needs, pain points, and opportunities. Validate problems through qualitative and quantitative discovery. Ensure engineering understands the why behind the problem.
1. **Product Strategy and Vision (VIABILITY):** Own the product vision, product narrative, and long-term direction. Translate strategy into clear product goals and themes. Evaluate market, business constraints. Ensure the roadmap aligns with company strategy and customer value. Prioritize the opportunities in the roadmap; engineering owns the implementation timelines.
1. **PRD Ownership (Problem to Solution):** Own the Product Requirements Document (PRD) and continuously define problems to solve. Define problem statements, goals, contexts, KPIs, and acceptance criteria at the product level. Provide clarity on scope and expected outcomes before engineering begins. Collaborate with STPL and FO to ensure requirements are technically meaningful.
1. **Prioritization and Outcome Alignment:** Prioritize based on impact, risk, value, and business viability. Communicate priorities to FOs and HoDs during the SW Ecosystem Sync. Ensure teams work toward measurable outcomes (not just shipping features).
1. **Cross-Functional Leadership (ENABLEMENT):** Align leadership, engineering, operations, and customer-facing teams. Communicate product direction and trade-offs across the company. Represent the customer's voice in all major decisions. Work closely with STPL and FO as a triad (strategy, system, feature).
1. **Release Governance and Customer Value Validation:** "Real validation happens in the hands of customers." Together with STPL, sign off that Beta results validate customer value. Approve Full Release and oversee communication. Monitor adoption, performance, customer experience, and impact. Ensure learnings from Beta flow into future iterations.
1. **KPIs and Product Impact Measurement:** PdMs own product outcomes and performance. Define product-level KPIs and success metrics. Track customer satisfaction, retention, performance outcomes, etc. Trigger product improvements or iteration cycles based on evidence.

**What the PdM Does Not Do:**

- Does not write technical requirements (FO and SE do)
- Does not manage developers or teams (HoDs do)
- Does not dictate solutions (engineering and design solve the how)
- Does not run sprints or ceremonies (domain teams do)
- Does not own system validation (STPL does)
- Does not prioritize tasks (teams do; PdM prioritizes outcomes)

> The PdM leads product outcomes, not execution.

### Systems Technical Project Lead (STPL)

The STPL is the technical owner of the system as a whole. They ensure that stakeholder needs are transformed into clear system requirements, that architecture is coherent across domains, and that the entire integrated system is validated before release.

Where the Feature Owner owns a feature, the STPL owns the system. The STPL safeguards system-level coherence, quality, and performance across the full lifecycle.

**Core Responsibilities:**

1. **Technical Governance and Alignment:** Act as the technical authority ensuring the system behaves as intended. Lead and participate in Design Reviews across the left side of the V. Unblock technical decisions that span multiple domains. Ensure no domain optimizes locally at the expense of the system.
1. **Cross-Functional Technical Leadership:** Act as the highest technical authority across the entire project. Main point of contact to suppliers for technical topics. Bridge domain teams, FO, PdM, Hardware teams, Cloud/App teams, Controls, and QRES. Ensure technical decisions remain consistent throughout the lifecycle. Escalate or drive architectural decisions when the system requires it.
1. **System Requirements Ownership:** Own the System Requirements Specification (SysReq). Translate Stakeholder Needs into clear, testable, system-level requirements. Ensure requirements are complete, consistent, traceable, and aligned with product goals. Collaborate with PdM to ensure stakeholder needs are accurately captured.
1. **System Architecture Leadership:** Own the System Architecture definition, including subsystem interactions, interfaces, and constraints. Allocate requirements to subsystems and define architectural boundaries. Ensure cross-domain consistency (Embedded, Controls, FE/BE, Mechanical). Review and approve software architecture (ADR) alignment with system constraints.
1. **Verification and Validation Ownership (Right Side of the V):** Accountable for System Validation (Alpha/Beta system-level testing). Lead execution of the System Validation Plan. Ensure that system behavior matches System Requirements, Stakeholder Needs, and product performance targets. Coordinate the System Tester during validation. Own the technical sign-off for system-level acceptance.
1. **Product Acceptance (Joint Accountability):** Run acceptance checks based on system validation evidence. Jointly sign-off (with PdM) that Beta was successful and ready for fleet rollout. Confirm that the feature/system is safe, stable, and fit for customer release.
1. **Documentation and Traceability:** Maintain end-to-end traceability: Stakeholder Needs to System Requirements to System Architecture to Verification to Validation. Ensure test plans cover all requirements. Keep system docs updated and accessible.

**What the STPL Does Not Do:**

- Does not run domain teams (HoDs do)
- Does not own feature requirements (Feature Owner does)
- Does not execute integration or SW Verification (System Tester + FO do)
- Does not define sprint scope or tasks (Teams do)
- Does not build or code components (Engineering teams do)

> The STPL owns the system, not the backlog or team management.

**Meeting clarification:** The STPL does NOT need to have expertise in all domains. They are responsible for making sure the system architecture and requirements come together, orchestrating input from domain experts (like a project manager for system coherence, not a technical expert in every area).

### Feature Owner (FO)

The Feature Owner is responsible for ensuring that a feature moves smoothly from stakeholder intent to delivered, including verification of its functionality. They bridge Product, Systems Engineering, and Domain Teams, ensuring clarity of requirements, architectural alignment, and integration readiness across the full SW lifecycle. The FO ensures that a feature is well understood, well architected, well prioritized, and well verified across all domains.

**Core Responsibilities:**

1. **Requirements and Feature Definition:** Translate stakeholder needs and/or system requirements into clear software requirements. Own the creation and quality of SW Requirements, Epics, acceptance criteria, and success conditions. Keep requirements aligned with System Requirements (when applicable). Make trade-offs explicit (scope, quality, complexity, timelines).
1. **Architecture and Alignment:** Ensure a proper SW Architecture / ADR is created before development begins. Facilitate collaboration between feature architect and engineering (domain) leads. Guarantee that the architecture complies with the System Architecture and constraints. Ensure that interfaces, sequences, and data flows are well defined before implementation.
1. **Cross-Domain Coordination:** Lead the weekly Cross-Functional Feature Alignment. Coordinate dependencies across embedded, controls, back-end, front-end, QA, etc. Keep teams synchronized on priorities, interfaces, and upcoming integration steps.
1. **Prioritization and Roadmap Execution:** Represent product priorities within the domain teams. Provide clarity during refinement and sprint planning on what matters most. Ensure readiness for future sprints (requirements, ADR, assets, test expectations).
1. **Execution Support:** Support domain teams during refinement by clarifying requirements. Answer questions quickly during sprints to unblock teams. Track progress toward the feature-level outcome rather than tasks.
1. **SW Verification Ownership:** Accountable for E2E Feature Integration Test execution and sign-off. Accountable for Software Verification Test sign-off at ecosystem level. Collaborate closely with the System Tester to ensure complete coverage. Ensure test evidence matches the SW Requirements and acceptance criteria.
1. **Communication and Documentation:** Maintain traceability across the V-model: Stakeholder Need to Requirements to ADR to Component to Integration to SW Verification. Keep documentation updated (Requirements, ADR, links, test-cases, readiness status reports). Serve as the single point of clarity for the feature.

**What the Feature Owner Does Not Do:**

- Does not own products (PdMs do)
- Does not manage teams (HoDs do)
- Does not dictate technical solutions (domain architects do)
- Does not run sprint ceremonies (HoDs or team-appointed facilitator do)
- Does not own component testing (Domain QA + HoDs do)
- Does not own system validation (STPL does)

> The FO owns feature clarity, consistency, and cross-domain coherence, not people nor tasks.

**Meeting clarification:** FOs are assigned per feature, not per team (transition from team-centric Product Owners to feature-centric Feature Owners). This is a gradual transition. FOs are freed from day-to-day team management (sprint planning, standups, etc.) to focus on cross-functional aspects. FOs have mandate to allocate resources based on agreed priorities.

### Head of Domain (HoD)

Heads of Domain are technical and organizational leaders responsible for the performance, execution, and growth of their engineering domain. They ensure that their teams deliver high-quality components, meet commitments, and operate according to the standards of the V-Scrum framework.

Where the Product Manager owns value, the STPL owns system correctness, and the Feature Owner owns feature clarity, the HoD owns domain execution, team capability, and technical quality within their area.

**Core Responsibilities:**

1. **People Leadership and Team Health:** Hire, onboard, coach, and develop engineers within the domain. Ensure teams have the skills, tools, and capacity to deliver. Create a high-performance culture based on ownership, alignment, and autonomy. Conduct performance reviews, career development, and mentorship.
1. **Technical Ownership of the Domain:** Own the technical direction of their domain (architecture patterns, standards, tooling). Ensure domain designs follow the System Architecture and ADRs (if applicable). Guarantee quality of implementations, code, hardware modules, or components. Unblock technical decisions within the domain when needed.
1. **Execution and Delivery Responsibility:** Ensure their teams deliver components on time and to the required quality. Facilitate domain-level Scrum ceremonies (team refinement, sprint planning, stand-ups and retrospectives). Assign or delegate the Scrum Master-like facilitator role within the team. Ensure the backlog is healthy, estimated, and actionable.
1. **Component Design and Readiness:** Own Component Design for their domain (HW/SW specifications, APIs, logic, mechanical drawings, etc.). Ensure components comply with system constraints, interface contracts, and ADR decisions. Produce required documentation (schemas, specs, design docs). Prepare the domain for implementation through clear designs. Ensure the components are validated.
1. **Component Testing (Multi-Domain):** Accountable for ensuring component-level testing. Domain QA verifies evidence. HoD signs off that the component is ready for integration.
1. **Cross-Functional Collaboration:** Support Feature Owners during refinement and alignment sessions. Collaborate with STPL on architectural alignment and system constraints. Work with Project Managers on timelines, risks, and dependencies (especially for HW projects). Ensure domain experts participate in design reviews.
1. **Governance and Accountability:** Own capacity planning and allocation of engineers to features or projects. Escalate risks early (staffing, competence gaps, technical bottlenecks). Drive continuous improvement in processes, tools, and team productivity. Maintain consistent engineering standards across teams.

**What HoDs Do Not Do:**

- Do not define system-level requirements (STPL does) but have an influence on them
- Do not own feature-level requirements or priorities but have an influence on them (FO does)
- Do not define product strategy or roadmap but have an influence on it (combined effort with PdM)
- Do not own cross-functional delivery of hardware projects (PjM does)
- Do not approve system validation or product acceptance (STPL + PdM)

> HoDs ensure their teams design, build, test, and deliver high-quality components that integrate smoothly into the full system.

**Meeting clarification:** This is a major change: HoDs take back responsibility for running development teams (backlog refinement, sprint planning, daily standups). This was previously the Product Owner's job. HoDs can delegate (appoint team members as scrum masters, delegate specific tasks) to manage capacity.

### System Tester

The System Tester is a QA engineer from one of the engineering domains who is temporarily appointed during the Project Kick-Off to take ownership of the integration and system-level testing for the feature. They ensure that components built by different teams work together as intended and that the integrated feature behaves according to the software requirements, system architecture, and acceptance criteria. The System Tester acts as the link between domain QA, the Feature Owner, and the STPL on the right side of the V.

**Why we assign this role dynamically:**

- Different features stress different parts of the system.
- The system tester is the one who understands the domain most impacted by the feature.
- This enables flexible staffing and reduces the need for a permanently staffed "system QA" team.
- It ensures domain expertise is directly applied to integration and verification.
- It enables knowledge increase across the QA team.

**Core Responsibilities:**

1. **Integration Test Ownership (E2E):** Plan test cases and execute feature-level integration tests across domains. Validate that components interact correctly (APIs, messages, timing, control loops). Document issues and coordinate with domain teams for fixes. Provide test evidence for FO sign-off.
1. **Software Verification Test (Ecosystem):** Execute the SW Verification Test (end-to-end within the ecosystem). Validate integrated behavior across different configurations, modes, and scenarios. Ensure coverage of the SW Requirements. FO signs off the results; the System Tester provides the evidence.
1. **Support System Validation:** Work with the STPL during System Validation (Alpha/Beta). Support execution of the validation plan (comfort, safety, noise, edge-case behavior). Provide logs, insights, and technical detail from the system-wide perspective.
1. **Traceability and Reporting:** Ensure test cases map to SW Requirements, ADR decisions, interface contracts, and acceptance criteria. Produce structured test reports for feature sign-off.

**Ownership by stage:**

- Feature Integration Test: FO is accountable; System Tester executes
- SW Verification Test: FO accountable; System Tester executes
- System Validation: STPL accountable; System Tester supports

**What the System Tester Does Not Do:**

- Does not own component testing (domain QA does, with exception of their own domain)
- Does not define requirements (FO/STPL do)
- Does not approve system validation results (STPL does)
- Does not drive feature priorities (PdM/FO do)

**Meeting clarification:** QA should be involved from the very beginning of feature development, including reviewing the ADR. This is an explicit change from prior process. The QA lead for a feature is also accountable for ensuring the test rig is ready (correct version, firmware on components), potentially preparing 3 days in advance.

### Project Manager (PjM)

The Project Manager ensures coordinated delivery of complex, cross-disciplinary work, especially when hardware, suppliers, manufacturing, compliance, and long lead-time activities are involved. Unlike the Product Manager (who owns value and customer problems), the Project Manager owns delivery coordination, timelines, risk management, and cross-organizational alignment for product-level or hardware-inclusive initiatives.

The PjM has formal authority over the project they lead to ensure decisions, priorities, and actions needed for successful delivery actually happen.

**The PjM role becomes essential when building:**

- An entire product (e.g., All-E, ODU V2, Kettle, Thermostat and/or future physical products)
- A major hardware module
- Any initiative requiring supplier co-development or industrialization

**Core Responsibilities:**

1. **Delivery Planning and Coordination:** Create and maintain the delivery plan, timeline, and milestones. Identify and track cross-domain dependencies (HW, SW, suppliers, certification). Ensure alignment across engineering, suppliers, manufacturing, supply chain and operations.
1. **Supplier and Partner Coordination:** Act as the primary operational interface with suppliers during: HW design co-development (from RfQ to delivery), manufacturing preparation, prototype builds, test planning, industrialization. Track supplier timelines, risks, costs and deliverables. Ensure supplier responsibilities are clear and contractual commitments are understood.
1. **Risk Management:** Identify program risks early and maintain a risk register (technical + schedule + supply chain). Drive mitigation plans with the relevant domain owners. Escalate risks that threaten timelines or product readiness.
1. **Governance and Reporting:** Maintain project reporting: status, timelines, deviations, blockers, supplier updates, readiness for next gates. JIRA maintenance. Drive readiness for quality gates (e.g., P2, P3, P4 cycles).
1. **Coordination of Cross-Functional Execution:** Ensure execution alignment across: Systems Engineering (STPL), Domain Teams (Heads of Domain), Supply chain, Production/Manufacturing, Procurement, Product Manager, Feature Owners, QA/Compliance.
1. **Ensuring Delivery of Non-Software (but coordinated) Activities:** Hardware prototyping and iterations, firmware flashing workflows, manufacturing tests (ICT, EOL), certification (CE, EMC, ErP, LVD), ramp-up readiness and initial logistics.

**What the PjM Does Not Do:**

- Does not own product strategy (PdM does)
- Does not choose the technical solution (STPL + domain architects)
- Does not manage people or teams (HoDs)
- Does not own system validation (STPL)

> The PjM owns delivery governance, not product value or system design.

---

## Role Summary

| Role          | Owns                                                                                                               | Does Not Own                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| PdM           | Problem space, product outcome, PRD, FRD, product roadmap, release approval                                        | Technical requirements, team management, system validation, sprint execution                 |
| STPL          | System as a whole, system requirements, system architecture, system validation, product acceptance (joint)         | Feature requirements, domain team management, sprint scope, component implementation         |
| FO            | Feature lifecycle, SW requirements, SW architecture alignment, cross-domain coordination, SW verification sign-off | Product strategy, team management, technical solutions, sprint ceremonies, system validation |
| HoD           | Domain execution, team capability, component design, component testing, Scrum facilitation                         | System requirements, feature priorities, product roadmap, cross-functional HW delivery       |
| System Tester | E2E integration testing, SW verification execution, system validation support                                      | Component testing (except own domain), requirements, validation sign-off, priorities         |
| PjM           | Delivery coordination, supplier management, risk management, cross-functional execution alignment                  | Product strategy, technical solutions, team management, system validation                    |

---

## Products

### What is a Product?

A product is something we intentionally build, evolve, and support because it delivers direct, independent value to customers or the business. It has a clear purpose, ownership, roadmap, and lifecycle.

**A Product Has (Most of These):**

- A clear value proposition (why it exists)
- Users or customers (internal or external)
- A roadmap and prioritization
- Ownership (Product Manager / Product function)
- A life cycle (build, release, operate, evolve)
- Success metrics (usage, value, revenue, efficiency, etc.)

### Our (Current) Products

**Clear Products** (deliver standalone or clearly marketable value):

- Heat Pump
- All-E
- Chill
- Battery
- EnergyOS
- Energy Contracts

**Enabling Products** (still products; do not deliver value alone, but are essential customer-facing components):

- App: User interaction, control, visibility
- CiC: Core embedded control enabling system behavior
- Dongle: Connectivity and data exchange (may be sold independently in the future)

They are products because they have users, have a roadmap, are released, updated and supported. They also have direct impact on customer experience.

### What Are Not Products

- SW Features (changes or capabilities within a product)
- Infrastructure
- Internal cloud platforms
- Internal tools

These are platforms or capabilities, not products.

**Software features are not products.** A feature does not deliver standalone value on its own, does not have its own roadmap, and is released as part of a product, not independently. Features exist to evolve a product, not to be one.

---

## Product Roadmap

A product roadmap is a living, strategic artifact that communicates intent, priorities, and sequencing across uncertainty, balancing customer outcomes, system risk, and organizational learning over time.

**What a product roadmap is:**

- A strategic alignment tool: aligns product, engineering, and leadership around shared intent
- An ecosystem-level view: reflects dependencies across hardware, software, and infrastructure
- Outcome- and capability-driven: focuses on what value we aim to deliver, not on features or components
- Time-oriented at a high level: uses year / quarter to indicate sequencing, not exact delivery dates
- A guide for trade-offs: makes priorities and constraints explicit across the portfolio

**What a product roadmap is not:**

- Not a project plan or Gantt chart
- Not a feature commitment list
- Not a Jira backlog
- Not a technical design document
- Not static

> If a roadmap item can be directly turned into a Jira-Epic, it does not belong on the product roadmap.

### How Product Roadmaps Come Together

Each product has its own roadmap, aligned with a shared ecosystem direction.

**What belongs to each product's roadmap:**

- Product-specific outcomes: what success looks like for that product
- Capabilities: what the product must be able to do to deliver those outcomes
- High-level time horizon: intended year / quarter for development and/or release
- Lifecycle stage: Discovery, Development, Release, Scale
- Known dependencies: explicit references to other products or infrastructure

**Ecosystem roadmap:** The ecosystem roadmap is the convergence of all product roadmaps. It exists to ensure consistency of direction, surface cross-product dependencies, and align timing across hardware, software, and infrastructure.

### How We Express Roadmap Items: Outcomes and Capabilities

- **Outcome (Why):** An outcome describes the customer or business result we aim to achieve. Expresses value, not solution. Observable and directionally measurable. Independent of implementation. Example: "Rooms can be cooled independently."
- **Capability (What):** A capability describes what the product or ecosystem must be able to do to achieve the outcome. Technology-agnostic. Works for physical products, software, and infrastructure. Stable over time, even if implementation changes.

The roadmap stops at capabilities.

### Lifecycle Stages on the Roadmap

- **Discovery:** Exploring user value, feasibility, and risk. Prototyping, research, early validation. Direction may still change.
- **Development:** Capability is being engineered and validated. Design decisions are being made. Integration and testing in progress.
- **Release:** Capability is ready for market or internal rollout. Documentation, enablement, and rollout complete. Feedback collection begins.

---

## Documentation and Tooling

### Current State

Today, requirements and documentation are scattered across multiple tools:

- PRDs: Google Docs (if available)
- System Requirements: Google Sheets (if available)
- Supplier specification: Google Docs
- ADR / Architecture: GitHub (with limited access for hardware teams)
- Detailed design documents: Slite, Google Docs (if available), GitHub
- Test Cases: Google Sheets (if available but no versioning, no ownership, no traceability)
- Jira: not connected to any of the above

No single source of truth. No automated link between requirements, design, tests, and Jira work. No systematic review or approval workflow. High risk of misalignment and rework.

This fragmentation is a root cause of late discoveries, inconsistent quality, missing requirements, lost decisions, and unclear ownership.

### Proposed Solution: Unified Requirements Platform (Jama)

Jama would give a single, integrated workspace for all product and system documentation:

- PRD: structured, version-controlled
- System Requirements: full coverage and traceability
- Supplier specification: release per quality gate
- Software Requirements: linked to features and epics
- ADR / Architecture Decisions: stored and reviewable
- Test Cases: directly mapped to requirements
- Verification and Validation Evidence: traceable per requirement
- Jira Integration: sync requirements with actual work items

**What This Enables:**

- A single source of truth accessible to all teams (HW, SW, Controls, FE/BE)
- Full traceability from stakeholder need to requirement to ADR to Jira to test to validation to release
- Structured reviews and approvals (with full history)
- Clear ownership for every requirement and change
- No more scattered documents or hidden spreadsheets
- Better quality, fewer surprises, and fewer integration issues

**Status:** Under evaluation (~50K/year). Until tooling is in place, the software requirements document serves as the single source of truth for the software side.

---

## Open Items (from the slide deck)

These are acknowledged as needing further definition:

- Discovery phases that lead to PRD and FRD
- Enrich framework version with QPDF (Quatt Product Development Framework) integration
- Add rituals at the product development level (Kick Off / CFT / Sprint planning)
- HW and SW interfaces: who is responsible for HW Features and how to ensure sync
- Process ownership: VP Engineering and Manufacturing
- HW Development Process: do they also work in features, with the same structure? How is work planned?
- In Embedded, there are Electrical Engineers. As HoD for EMB how to maintain EE ownership and plan work accordingly? (Specifics for HW development with FMEA, 2D, 3D, Moldflow analysis, Schematics, Layouts, Gerber)
- HW/SW Silos: how does information structurally pass from the HW teams to SW and vice-versa? (Production dates, customer demos, need for marketing rigs, prototype arrival, board bring-ups etc.) Answer: QPDF enforcement + Project rituals
- EnergyOS and VPP integration?
- Product ownership: who owns the CiC? (control can release a hotfix without EMB involvement)
- Fleet Performance and Monitoring responsibility?
- Ownership of 3rd party SW (i.e. ODU fw or CHILL control fw)? Ownership, validation, standard documentation, versioning, interface definitions.
- Problems with interfaces: how to solve them (STPL and the ADR Owner paired)
- Feature releases: not communicated

---

## Open Questions (from team discussions)

These were raised during the framework introduction meetings (January and February 2026) and remain unresolved or partially resolved:

### Documentation maintenance without tooling

Without a requirements management tool, changing one requirement at a higher level requires manually updating multiple documents. Acknowledged as a real risk with no clean solution yet. Current mitigation: use the software requirements document as the single source of truth for software; update other documents later. AI-assisted propagation is being explored.

### Scrum Master role

The Scrum Master role was never formally defined at Quatt. It was implicitly done by POs, and now responsibilities are split across roles. Suggestion to look more specifically at what a Scrum Master actually does. Currently parked as a capacity constraint (can't hire for the role).

### Scrum iteration value with more upfront work

Concern that increased certainty from upfront work removes the core value of scrum (frequent iteration cycles). Response: the rhythm/heartbeat for engineering teams is still needed; upfront work on behaviors, safeties, and cross-discipline definitions prevents rework; there's still room for iteration within the cycle. Where Scrum autonomy is constrained is in the "what" (priorities come from above more concretely), but the "how" of implementation remains open and iterative.

### Post-release customer validation

System validation against the PRD doesn't include actual customer feedback. The framework validates against what the PRD says, but the product could still miss what customers actually need. Post-release monitoring and customer feedback feeding back into PRD/requirements is acknowledged as important but not fully covered by the framework.

### Requirements that can't be tested in the lab

PRD/FRD metrics like "50% of customers should increase savings by X" can't be tested in a controlled lab. Clarification: system requirements must be testable. If something can't be tested in the lab, it cannot be a system requirement. Those metrics must be monitored in the field after release.

### Hardware and industrial design validation

How does the framework apply to industrial design? Who tests that? The intent is to release the software process first and then work on hardware/industrial design validation. Defining requirements and validation for those areas ahead of time would be a good idea.

### Feature scope sizing

Concern that splitting features too small led to team members working on many overlapping tasks, losing the full picture. Agreement: make feature scopes slightly bigger, even if delivery extends beyond one quarter. This clarifies ownership, makes upfront work more valuable, and reduces task switching.

### Release constraints for backend

Only one backend/cloud currently supports all features across all devices. Rolling out features to specific user groups on the backend is currently not possible without rearchitecting. Feature availability can be managed by CSC version for devices and app, but the backend is always live for all users. Left as an open topic.

### Cross-functional collaboration risk

Concern that the framework pushes work more internally within domains, potentially worsening cross-functional collaboration. Response: the weekly Cross-Functional Feature Alignment and Slack channels for specific features are meant to address this. The framework frees Feature Owners to focus on cross-functional work.

### Traceability aspirations vs. reality

Full traceability from PRD requirements through the process is the goal, but currently challenging with Google Docs, spreadsheets, and GitHub. Tooling would make this manageable. For now, it's aspirational context rather than a hard expectation.

### Development not blocked by missing documents

The framework is the northstar/guideline, but development will NOT be blocked if all documents aren't complete yet. The team should move in this direction progressively.

