# `/research` Skill - Quick Reference Card

**One-Page Summary for Busy Reviewers**

---

## What Is This?

A proposed Claude Code skill that conducts autonomous, validated research with automatic citation verification.

**Invocation:** `/research <topic>`

**Output:** Structured markdown report with verified references and confidence levels

**Key Innovation:** Self-validates every factual claim against sources (no hallucinations)

---

## The Problem

Developers need research, but current approaches have issues:
- ❌ Ad-hoc Claude conversations: No persistence, no validation
- ❌ Manual web research: Time-consuming, easy to miss sources
- ❌ Perplexity/external tools: Can't search codebase, no validation

## The Solution

`/research` skill provides:
- ✅ Autonomous multi-source research (web + codebase + Jira + GitHub)
- ✅ Automatic validation (verifies stars, dates, versions against sources)
- ✅ Persistent reports (markdown in `./task-context/task/<name>/research.md`)
- ✅ Confidence levels (HIGH/MEDIUM/LOW for all claims)
- ✅ 60-80% time savings vs manual research

---

## How It Works (5 Phases)

```
User: /research "Compare RBAC libraries for Node.js"
  ↓
1. CLARIFICATION (2-5 min)
   - Ask targeted questions to understand scope
   - Define success criteria
  ↓
2. RESEARCH (15-30 min)
   - Search web, GitHub, npm, codebase
   - Gather facts and sources
  ↓
3. VALIDATION (10-20 min)
   - Verify every factual claim against sources
   - WebFetch sources to extract actual data
   - Compare claims to extracted data
   - Assign ✅ VERIFIED / ⚠️ PARTIAL / ❌ FAILED status
  ↓
4. SYNTHESIS (5-10 min)
   - Create structured research.md report
   - Include executive summary + recommendations
   - List validated references with confidence levels
  ↓
5. DELIVERY (1-2 min)
   - Present concise summary to user
   - Provide path to full report
```

**Total Duration:** 30-45 minutes for thorough research

---

## Example: Library Comparison

**User Input:**
```bash
/research "Compare RBAC libraries for Node.js"
```

**Validation in Action:**

```markdown
**Claim:** "CASL has 6.8k GitHub stars"

**Validation:**
1. WebFetch: https://github.com/stalniy/casl
2. Extracted: "6,847 stars"
3. Comparison: 6,847 ≈ 6.8k ✅
4. Status: ✅ VERIFIED (HIGH confidence)
5. Verified on: 2026-01-28
```

**Output Report:**

| Library | Stars | Maintenance | TypeScript | Status | Recommendation |
|---------|-------|-------------|------------|--------|----------------|
| CASL | 6.8k ✅ | Jan 2026 ✅ | Native ✅ | ✅ VERIFIED | ⭐ Recommended |
| Casbin | 2.9k ✅ | Jan 2026 ✅ | 99.9% ✅ | ✅ VERIFIED | Consider |

**Recommendation:** Use CASL for TypeScript-first projects (18/18 claims verified, 100% confidence)

**Full Report:** `./task-context/task/rbac-libraries/research.md`

---

## Key Features

### Automatic Validation
- ✅ Verifies GitHub statistics (stars, forks, last commit)
- ✅ Verifies npm statistics (downloads, versions)
- ✅ Verifies dates (release dates, maintenance status)
- ✅ Detects broken links (404s)
- ✅ Cross-references multiple sources

### Smart Source Selection
- Web search for external research
- Codebase search (Explore agent) for internal patterns
- GitHub for repository statistics
- npm for package data
- Jira for historical context (if applicable)

### Quality Guarantees
- 90%+ claims achieve ✅ VERIFIED status
- Every claim has traceable source
- Confidence levels (HIGH/MEDIUM/LOW) for all claims
- Broken links marked as ❌ FAILED

### Persistent Output
- Markdown reports in `./task-context/task/<research-name>/research.md`
- Shareable with team
- Version-controllable
- Includes executive summary for quick reading

---

## Use Cases

### 1. Library/Framework Comparison
**Example:** "Compare React state management libraries"
**Validates:** GitHub stars, npm downloads, maintenance dates, TypeScript support
**Duration:** 20-30 minutes

### 2. Codebase Pattern Documentation
**Example:** "How do we handle streaming endpoints?"
**Sources:** Codebase files, existing implementations
**Duration:** 10-20 minutes

### 3. Architecture Decision Research
**Example:** "Should we migrate from MySQL to PostgreSQL?"
**Validates:** Performance claims, compatibility, migration effort
**Duration:** 30-45 minutes

### 4. Bug Investigation
**Example:** "Why does timezone handling fail during DST?"
**Sources:** Codebase, web research on timezone best practices
**Duration:** 10-20 minutes

### 5. Security/Best Practices
**Example:** "OWASP recommendations for API authentication"
**Validates:** Standards compliance, industry practices
**Duration:** 20-30 minutes

---

## Technical Requirements

**Existing Claude Code Tools Used:**
- Task (Explore agent) - Codebase search
- WebSearch - Finding external sources
- WebFetch - Retrieving and validating references
- AskUserQuestion - Clarification questions
- Glob/Grep/Read - File access
- Write - Report generation

**No new external dependencies required**

**Token Usage:** 60k-120k per research session

**Implementation Effort:** 2-3 weeks for Claude Code team

---

## Success Criteria

### Must Have (v1.0)
- ✅ User can invoke `/research <topic>`
- ✅ 90%+ of factual claims verified
- ✅ Research report created in task-context/
- ✅ All references include verification status
- ✅ Executive summary + recommendations
- ✅ < 45 min completion time

### Nice to Have (v1.1+)
- Resume interrupted research
- Real-time progress streaming
- Export to PDF/HTML
- Integration with `/plan` skill

---

## Validation Examples

### ✅ Exact Match (HIGH confidence)
```
Claim: "Library has 2,947 stars"
Actual: "2,947 stars"
Result: ✅ VERIFIED
```

### ✅ Rounded Match (HIGH confidence)
```
Claim: "Package has 2M downloads"
Actual: "1,847,392 weekly downloads"
Result: ✅ VERIFIED (1.8M ≈ 2M within rounding)
```

### ⚠️ Partial Match (MEDIUM confidence)
```
Claim: "Library is well-maintained"
Actual: "Last update 9 months ago, 47 open issues"
Result: ⚠️ PARTIAL (subjective claim, mixed evidence)
```

### ❌ Failed Validation
```
Claim: "Library has 5k stars"
Actual: 404 Not Found (broken link)
Result: ❌ FAILED (cannot verify)
```

---

## Comparison to Alternatives

| Feature | `/research` Skill | Manual Research | Perplexity | Ad-hoc Claude Chat |
|---------|-------------------|-----------------|------------|-------------------|
| **Time** | 30-45 min | 2-4 hours | 10-30 min | 15-60 min |
| **Validation** | ✅ Automatic | ❌ Manual | ❌ None | ❌ None |
| **Persistence** | ✅ Markdown | ⚠️ Notes | ❌ Session only | ❌ Conversation only |
| **Codebase** | ✅ Yes | ❌ Manual | ❌ No | ✅ Yes |
| **Confidence** | ✅ Explicit levels | ⚠️ Implicit | ❌ No levels | ❌ Implicit trust |
| **Citations** | ✅ Validated refs | ⚠️ May miss | ✅ Links only | ⚠️ Inconsistent |

---

## Decision Points for Reviewers

### 1. Scope
- **Full v1.0** (all 5 phases including validation) - Recommended
- **MVP** (skip validation, add later) - Faster to ship

### 2. Validation Depth
- **Heavy** (validate all claims) - Recommended
- **Medium** (validate critical claims only)
- **Light** (basic validation)

### 3. Integration
- **Standalone** - Recommended for v1.0
- **Integrated** with `/plan`, `/commit` - Consider for v1.1

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Broken references** | Validation catches 404s, marks as ❌ FAILED |
| **Outdated info** | Include verification date, lower confidence for old sources |
| **Bias toward first results** | Search multiple sources, cross-validate |
| **Long duration** | Progress indicators, offer "quick" mode |
| **Rate limiting** | Implement backoff, caching, optional API tokens |

---

## Next Steps if Accepted

1. **Prototype** (1 week) - Build minimal version, test with 5-10 users
2. **Alpha** (2 weeks) - Full implementation, internal testing
3. **Beta** (4 weeks) - External users, iterate on feedback
4. **GA** - General availability to all Claude Code users

---

## Documents in This Proposal

1. **README.md** - Navigation guide and overview
2. **RESEARCH_SKILL_DESIGN.md** - Complete technical specification (20 pages)
3. **EXAMPLES.md** - Detailed usage examples (15 pages)
4. **QUICK_REFERENCE.md** - This document (one-page summary)

**Start Here:** Read this quick reference, then dive into EXAMPLES.md for concrete scenarios.

---

## Contact

**Proposal Author:** Noah Clark (clarknoah@quatt.com)
**Organization:** Quatt Cloud Team
**Date:** 2026-01-28

---

## Bottom Line

**For Claude Code Team:**
- 2-3 weeks implementation effort
- Uses existing tool infrastructure
- High user value (60-80% time savings)
- Key differentiator (self-validation)

**For Users:**
- Invoke: `/research <topic>`
- Wait: 30-45 minutes
- Receive: Validated research report with confidence levels
- Save: 60-80% time vs manual research

**Recommendation:** Approve for prototype phase to validate core assumptions.
