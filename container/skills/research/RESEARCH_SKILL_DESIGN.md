# `/research` Skill Design Specification

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Proposal
**Target:** Claude Code CLI Enhancement

---

## Executive Summary

The `/research` skill is a proposed Claude Code enhancement that enables autonomous, validated research across multiple sources with proper citation verification and structured output. Unlike ad-hoc research conversations, this skill enforces rigorous validation, maintains citation integrity, and produces persistent, shareable research reports.

**Key Innovation:** Self-verifying claims through automated reference validation, eliminating the "LLM hallucination" problem in research outputs.

**Expected Impact:**
- Reduces research time by 60-80% through automation
- Eliminates citation errors via automated verification
- Creates reusable, shareable research artifacts
- Enables confident decision-making with validated data

---

## Problem Statement

### Current State

When developers need to research technical topics (library comparisons, architectural patterns, security best practices), they typically:

1. Ask Claude ad-hoc questions in conversation
2. Manually verify claims by visiting reference links
3. Lose research context when conversation ends
4. Cannot easily share findings with team
5. Risk making decisions on unverified information

### Pain Points

- **No persistence:** Research disappears when conversation ends
- **Manual verification:** Must check every link and claim manually
- **Citation gaps:** Easy to forget sources or provide broken links
- **No structure:** Findings scattered across conversation
- **Trust issues:** Cannot verify if claims match cited sources

### Proposed Solution

A dedicated `/research` skill that:
- Conducts autonomous research across multiple sources
- **Automatically validates** every factual claim against sources
- Creates persistent, structured research reports
- Provides confidence levels for all findings
- Enables team collaboration through shareable artifacts

---

## Skill Overview

### Invocation

```bash
/research <topic>
/research --sources web,codebase <topic>
/research --depth quick <topic>
```

### Parameters

```typescript
interface ResearchSkillArgs {
  topic: string;                    // Research topic or question
  sources?: string[];               // Optional: limit to specific sources
                                    // Options: 'web', 'codebase', 'jira', 'github'
  depth?: 'quick' | 'thorough';     // Default: 'thorough'
                                    // quick = 10-15 min, thorough = 30-45 min
}
```

### Expected Output

**Primary:** Structured markdown research report in `./task-context/task/<research-name>/research.md`

**Secondary:** Concise summary presented to user with key findings and recommendations

---

## Workflow Design

### Phase 1: Clarification (2-5 minutes)

**Objective:** Understand research scope and requirements before conducting research

**Process:**
1. Parse user's research topic/question
2. Identify ambiguities and missing context
3. Ask 2-4 targeted clarification questions using AskUserQuestion tool
4. Define success criteria and expected deliverables

**Example Questions:**
- "Should I compare specific libraries (e.g., Casbin vs CASL) or survey the entire category?"
- "Are you looking for production-ready solutions or experimental approaches?"
- "What's your primary concern: performance, security, maintainability, or cost?"
- "Do you need implementation examples or just architectural guidance?"

**Output:** Clear research scope document

### Phase 2: Research (15-30 minutes)

**Objective:** Gather information from all relevant sources

**Source Selection (Automatic):**

```typescript
// Automatically determine sources based on topic keywords
const sourceMapping = {
  library: ['web', 'github', 'npm'],
  package: ['web', 'github', 'npm'],
  framework: ['web', 'github', 'npm'],
  api: ['codebase', 'openapi'],
  endpoint: ['codebase', 'openapi'],
  route: ['codebase'],
  bug: ['jira', 'codebase'],
  issue: ['jira', 'codebase'],
  ticket: ['jira'],
  'best practice': ['web'],
  pattern: ['web', 'codebase'],
  security: ['web', 'codebase', 'owasp'],
  auth: ['web', 'codebase'],
  permission: ['web', 'codebase'],
};
```

**Research Activities:**

1. **Codebase Search** (Task tool with Explore agent)
   - Search for relevant implementations
   - Identify patterns and conventions
   - Extract configuration and usage examples
   - Document file locations with absolute paths

2. **Web Search** (WebSearch tool)
   - Find industry best practices
   - Locate official documentation
   - Discover recent blog posts and tutorials
   - Identify GitHub repositories and npm packages

3. **GitHub Research** (WebFetch on GitHub URLs)
   - Extract repository statistics (stars, forks, issues)
   - Check maintenance status (last commit, release dates)
   - Review documentation quality
   - Assess community activity

4. **Jira Search** (if applicable)
   - Find related tickets and bug reports
   - Understand historical context
   - Identify known issues and workarounds

**Output:** Raw findings with preliminary sources

### Phase 3: Validation (10-20 minutes)

**Objective:** Verify every factual claim against authoritative sources

**Critical Innovation:** Self-verifying research

For each factual claim in the research:
1. Identify the source reference
2. Use WebFetch to retrieve the source content
3. Extract specific data points (numbers, dates, versions)
4. Compare extracted data to the claim
5. Mark validation status
6. Assign confidence level

**Validation Statuses:**

- ✅ **VERIFIED** - Claim exactly matches source data
- ⚠️ **PARTIAL** - Claim mostly accurate but minor discrepancies
- ❌ **FAILED** - Claim contradicts source or source unavailable
- 🔄 **PENDING** - Manual verification required

**Confidence Levels:**

- **HIGH** - Primary source, recently verified, exact match
- **MEDIUM** - Secondary source, older data, approximate match
- **LOW** - Tertiary source, significant age, unclear match

**Example Validation:**

```markdown
**Claim:** "Casbin has 2.9k GitHub stars and was last updated January 2026"

**Validation Process:**
1. Source: https://github.com/casbin/node-casbin
2. WebFetch: Retrieved repository page
3. Extracted data:
   - Stars: 2,947 (displayed as "2.9k")
   - Last release: v5.48.0 on Jan 10, 2026
   - Last commit: Jan 15, 2026
4. Comparison:
   - Stars: ✅ Match (2,947 ≈ 2.9k)
   - Update date: ✅ Match (Jan 2026)
5. Status: ✅ VERIFIED
6. Confidence: HIGH
7. Verified on: 2026-01-27

**Citation:** [Casbin GitHub Repository](https://github.com/casbin/node-casbin) - verified 2026-01-27
```

**Validation Rules:**

1. **Numerical claims:** Must match within ±5% or round to same display value
2. **Date claims:** Must match within stated precision (month, year, etc.)
3. **Version claims:** Must match exact version string
4. **Status claims:** Must reflect current state ("active", "maintained", etc.)
5. **Broken links:** Marked as ❌ FAILED with note to find alternative source

**Output:** Validated findings with confidence levels

### Phase 4: Synthesis (5-10 minutes)

**Objective:** Create structured, actionable research report

**Report Structure:**

```markdown
# Research: <Topic>
**Date:** <YYYY-MM-DD>
**Requested by:** <username>
**Research Context:** <Why this research was needed>
**Validation Status:** <X/Y claims verified>

## Executive Summary
[3-5 sentences summarizing key findings and primary recommendation]

## Research Questions
[3-5 specific questions this research aimed to answer]

## Findings

### 1. Codebase Analysis
[Current implementation details with file paths]

### 2. External Research
[Industry best practices, standards, documentation]

### 3. Comparative Analysis
[Tables comparing options with verified metrics]

## Recommendations

### Primary Recommendation
[Clear, actionable recommendation with rationale]

### Alternative Approaches
[Other viable options with tradeoffs]

### Implementation Considerations
[Key points to consider during implementation]

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|---------|------------|
| [Risk 1] | [H/M/L] | [H/M/L] | [Strategy] |
| [Risk 2] | [H/M/L] | [H/M/L] | [Strategy] |

## References

### Validated Sources
[Sources with verification status and confidence level]

1. **[Source Title](URL)** - ✅ VERIFIED (HIGH confidence)
   - Verified: <specific data points>
   - Date: <verification date>

2. **[Source Title](URL)** - ⚠️ PARTIAL (MEDIUM confidence)
   - Verified: <what matched>
   - Discrepancy: <what didn't match>
   - Date: <verification date>

### Additional Resources
[Supplementary reading, not directly cited in findings]

- [Resource 1](URL)
- [Resource 2](URL)

## Appendix

### Alternatives Considered
[Approaches explored but not recommended, with reasoning]

### Validation Log
[Detailed validation steps for transparency]

### Related Jira Tickets
[If applicable: QPD-XXXX, QPD-YYYY]
```

**Output:** Complete research.md file in task-context/task/<research-name>/

### Phase 5: Delivery (1-2 minutes)

**Objective:** Present findings to user and provide access to full report

**Presentation:**

```markdown
Research complete! Here's what I found:

## <Topic> - Key Findings

**Recommendation:** <Primary recommendation in 1-2 sentences>

**Key Insights:**
- <Insight 1 with confidence level>
- <Insight 2 with confidence level>
- <Insight 3 with confidence level>

**Validation:** Verified X/Y factual claims (Y% confidence)

**Full Report:** `./task-context/task/<research-name>/research.md`

**Next Steps:**
1. <Actionable step 1>
2. <Actionable step 2>
3. <Actionable step 3>

Would you like me to clarify any findings or explore alternatives?
```

---

## Reference Validation Engine

### Core Algorithm

```typescript
interface ValidationResult {
  claim: string;
  source: string;
  status: 'VERIFIED' | 'PARTIAL' | 'FAILED' | 'PENDING';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  extractedData: Record<string, any>;
  discrepancies: string[];
  verifiedAt: string;
}

async function validateClaim(
  claim: string,
  sourceUrl: string
): Promise<ValidationResult> {
  // 1. Fetch source content
  const content = await WebFetch({
    url: sourceUrl,
    prompt: `Extract factual data points relevant to: "${claim}"`
  });

  // 2. Parse extracted data
  const extractedData = parseDataPoints(content);

  // 3. Compare claim to extracted data
  const comparison = compareClaim(claim, extractedData);

  // 4. Determine validation status
  const status = determineStatus(comparison);

  // 5. Assign confidence level
  const confidence = assessConfidence(sourceUrl, comparison, content);

  return {
    claim,
    source: sourceUrl,
    status,
    confidence,
    extractedData,
    discrepancies: comparison.discrepancies,
    verifiedAt: new Date().toISOString(),
  };
}
```

### Validation Strategies by Claim Type

#### GitHub Statistics

```typescript
async function validateGitHubStats(
  claim: string,
  repoUrl: string
): Promise<ValidationResult> {
  const content = await WebFetch({
    url: repoUrl,
    prompt: 'Extract: star count, fork count, last commit date, latest release version and date, open issues count'
  });

  // Extract numerical values from claim
  const claimedStats = parseGitHubClaim(claim);

  // Compare with extracted data
  const matches = {
    stars: compareNumbers(claimedStats.stars, content.stars),
    forks: compareNumbers(claimedStats.forks, content.forks),
    lastUpdate: compareDates(claimedStats.lastUpdate, content.lastCommit),
    // ... other comparisons
  };

  return buildValidationResult(matches);
}
```

#### npm Package Statistics

```typescript
async function validateNpmStats(
  claim: string,
  packageName: string
): Promise<ValidationResult> {
  const npmUrl = `https://www.npmjs.com/package/${packageName}`;

  const content = await WebFetch({
    url: npmUrl,
    prompt: 'Extract: weekly downloads, version, last publish date, dependencies count'
  });

  // Similar comparison logic
}
```

#### Documentation Claims

```typescript
async function validateDocsClaim(
  claim: string,
  docsUrl: string
): Promise<ValidationResult> {
  const content = await WebFetch({
    url: docsUrl,
    prompt: `Verify if this documentation states: "${claim}"`
  });

  // Use semantic similarity for feature claims
  const similarity = assessSemanticMatch(claim, content);

  return {
    status: similarity > 0.9 ? 'VERIFIED' : 'PARTIAL',
    confidence: similarity > 0.9 ? 'HIGH' : 'MEDIUM',
    // ... rest of result
  };
}
```

### Confidence Assessment

```typescript
function assessConfidence(
  sourceUrl: string,
  comparison: ComparisonResult,
  content: string
): 'HIGH' | 'MEDIUM' | 'LOW' {
  let score = 0;

  // Source authority
  if (isOfficialDocs(sourceUrl)) score += 3;
  else if (isGitHub(sourceUrl)) score += 2;
  else if (isReputableBlog(sourceUrl)) score += 1;

  // Recency
  const age = getContentAge(content);
  if (age < 6) score += 3;        // < 6 months
  else if (age < 12) score += 2;  // < 1 year
  else if (age < 24) score += 1;  // < 2 years

  // Match quality
  if (comparison.exactMatch) score += 3;
  else if (comparison.closeMatch) score += 2;
  else if (comparison.approximateMatch) score += 1;

  // Determine confidence level
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}
```

---

## Example Research Sessions

### Example 1: Library Comparison

**User Input:**
```
/research "Compare RBAC libraries for Node.js - need production-ready solution"
```

**Clarification Phase:**
```
I'll research RBAC libraries for Node.js. A few questions to focus the research:

1. Should I compare specific libraries you have in mind, or survey all popular options?
   - Compare specific libraries: Casbin, CASL, accesscontrol
   - Survey all popular options (Recommended)

2. What's your primary concern?
   - Performance and scalability
   - Developer experience and TypeScript support
   - Flexibility and feature completeness (Recommended)

3. What's your deployment context?
   - Microservices with distributed auth
   - Monolithic application (Recommended)

4. Do you need?
   - Just recommendations
   - Recommendations + implementation examples (Recommended)
```

**User Response:**
```
Survey all options, prioritize TypeScript support and maintenance, monolithic app, just recommendations
```

**Research Output:**

```markdown
# Research: Node.js RBAC Libraries for Production Use
**Date:** 2026-01-28
**Validation Status:** 18/18 claims verified (100%)

## Executive Summary

After evaluating 7 RBAC libraries, **CASL** is recommended for TypeScript-first projects requiring flexible authorization. It provides the best developer experience with strong type safety, active maintenance, and comprehensive documentation. Alternative: Build custom RBAC if requirements are simple (< 5 roles, no complex policies).

## Findings

### Library Comparison

| Library | Stars | Maintenance | TypeScript | Status | Recommendation |
|---------|-------|-------------|------------|--------|----------------|
| CASL ✅ | 6.8k ✅ | Active (Jan 2026) ✅ | Native ✅ | ✅ VERIFIED | ⭐ Recommended |
| Casbin | 2.9k ✅ | Active (Jan 2026) ✅ | 99.9% ✅ | ✅ VERIFIED | Consider |
| accesscontrol | 2.3k ✅ | Unclear ⚠️ | Yes ✅ | ⚠️ PARTIAL | Avoid |

[... detailed analysis ...]

## Recommendations

### Primary: Use CASL
- ✅ Best TypeScript support
- ✅ Actively maintained
- ✅ Flexible policy definitions
- ✅ Excellent documentation

### Alternative: Custom Implementation
- Consider if: < 5 roles, no complex policies, existing middleware
- Pros: Full control, zero dependencies
- Cons: More initial development time

## References

### Validated Sources

1. **[CASL GitHub](https://github.com/stalniy/casl)** - ✅ VERIFIED (HIGH confidence)
   - Verified: 6,847 stars, last release v6.8.2 on Jan 5, 2026
   - Date: 2026-01-28

2. **[Casbin GitHub](https://github.com/casbin/node-casbin)** - ✅ VERIFIED (HIGH confidence)
   - Verified: 2,947 stars, last release v5.48.0 on Jan 10, 2026
   - Date: 2026-01-28

[... rest of report ...]
```

### Example 2: Codebase Pattern Research

**User Input:**
```
/research "How do we handle streaming endpoints in our codebase?"
```

**Research Output:**

```markdown
# Research: Streaming Endpoint Patterns in Quatt Cloud
**Date:** 2026-01-28
**Validation Status:** N/A (codebase analysis)

## Executive Summary

The codebase implements Server-Sent Events (SSE) streaming through a shared infrastructure pattern in `src/shared/services/streaming/`. Two active streaming endpoints exist: `/admin/mqtt-debug/stream` for MQTT debugging and `/admin/cic/:cicId/device-stream` for real-time device data. The pattern uses Redis pub/sub for message distribution and provides a consistent architecture for adding new streaming endpoints.

## Findings

### Current Implementation

**Shared Infrastructure:**
- `AdminSseStreamingService` (/Users/clarknoah/Development/Quatt-cloud/src/shared/services/streaming/AdminSseStreamingService.ts)
  - Handles SSE headers, connection management, heartbeat
  - Provides message sending, error handling, cleanup
  - Supports configurable message processors

- `RedisStreamRepository` (/Users/clarknoah/Development/Quatt-cloud/src/shared/repository/streaming/RedisStreamRepository.ts)
  - Generic Redis pub/sub management
  - Connection lifecycle handling
  - Type-safe message parsing

**Active Endpoints:**
1. `/admin/mqtt-debug/stream` - Raw MQTT message streaming
2. `/admin/cic/:cicId/device-stream` - Real-time device data

### Pattern for New Streaming Endpoints

[... implementation guide ...]

## Recommendations

### Use Existing Infrastructure
Do NOT create new SSE handling code. Use the shared pattern:
1. Create domain-specific service extending shared infrastructure
2. Implement MessageProcessor interface
3. Register route with proper error handling

### Example Implementation
[... code example ...]

## References

### Codebase Files (Absolute Paths)
- /Users/clarknoah/Development/Quatt-cloud/src/shared/services/streaming/AdminSseStreamingService.ts
- /Users/clarknoah/Development/Quatt-cloud/src/shared/repository/streaming/RedisStreamRepository.ts
- /Users/clarknoah/Development/Quatt-cloud/src/admin/routes/mqtt-debug-stream.ts
```

---

## Integration with Claude Code

### Tool Requirements

The `/research` skill requires these existing Claude Code tools:

1. **Task** - For spawning Explore agent to search codebase
2. **WebSearch** - For finding external resources
3. **WebFetch** - For retrieving and analyzing web content
4. **AskUserQuestion** - For clarification questions
5. **Glob/Grep/Read** - For codebase file access
6. **Write** - For creating research report

### Skill Registration

The skill should be registered alongside existing skills like `/commit`, `/review-pr`:

```typescript
// In Claude Code skill registry
export const researchSkill: Skill = {
  name: 'research',
  description: 'Conduct rigorous, validated research with proper citations',
  category: 'analysis',

  async execute(args: string, context: SkillContext): Promise<void> {
    // Phase 1: Clarification
    const scope = await clarifyScope(args, context);

    // Phase 2: Research
    const findings = await conductResearch(scope, context);

    // Phase 3: Validation
    const validated = await validateReferences(findings);

    // Phase 4: Synthesis
    const reportPath = await createResearchReport(scope, validated);

    // Phase 5: Delivery
    await presentSummary(validated, reportPath);
  }
};
```

### User Experience Flow

```
$ claude /research "Compare authentication libraries"

Claude: I'll research authentication libraries for you. A few questions first:
[Interactive clarification via AskUserQuestion tool]

Claude: Starting research across web, GitHub, and npm...
[Progress indicators as research proceeds]

Claude: Validating claims against sources...
✓ Verified 12/12 GitHub statistics
✓ Verified 8/8 maintenance dates
✓ Verified 5/5 feature claims

Claude: Research complete! Here's what I found:

## Authentication Libraries - Key Findings
...

Full report: ./task-context/task/authentication-libraries/research.md
```

---

## Success Criteria

### Functional Requirements

- ✅ User can invoke `/research <topic>` and receive structured report
- ✅ All numerical claims verified against sources (within ±5%)
- ✅ All date claims verified against sources
- ✅ Research document created in `task-context/task/<name>/research.md`
- ✅ Executive summary accurately reflects findings
- ✅ Recommendations are actionable and specific
- ✅ All references include verification status and confidence level
- ✅ Broken links detected and marked as ❌ FAILED

### Quality Requirements

- ✅ At least 90% of factual claims should achieve ✅ VERIFIED status
- ✅ All VERIFIED claims must have confidence level (HIGH/MEDIUM/LOW)
- ✅ Research completion time: < 45 minutes for thorough research
- ✅ Report readability: Executive summary understandable in < 2 minutes
- ✅ Citation completeness: Every claim has traceable source

### User Experience Requirements

- ✅ Clarification questions are clear and actionable
- ✅ Progress is visible during long research operations
- ✅ Summary is presented immediately upon completion
- ✅ Full report is accessible via clear file path
- ✅ Validation failures are explained with actionable guidance

---

## Testing Strategy

### Unit Tests

1. **Claim Parsing**
   - Extract numerical values from text claims
   - Parse date expressions
   - Identify claim types (GitHub stats, npm downloads, etc.)

2. **Validation Logic**
   - Number comparison with tolerance
   - Date comparison with precision
   - Semantic similarity for feature claims

3. **Confidence Scoring**
   - Source authority ranking
   - Recency assessment
   - Match quality scoring

### Integration Tests

1. **GitHub Validation**
   - Verify live repository statistics
   - Handle rate limiting gracefully
   - Parse different GitHub UI formats

2. **npm Validation**
   - Extract package statistics
   - Handle scoped packages
   - Detect deprecated packages

3. **Web Fetch Validation**
   - Handle 404 errors
   - Parse various site structures
   - Extract data from blogs, docs, tutorials

### End-to-End Tests

1. **Simple Research**
   - Topic: "What is Redis?"
   - Expected: Web sources only, verified definition
   - Duration: < 10 minutes

2. **Library Comparison**
   - Topic: "Compare X vs Y libraries"
   - Expected: GitHub stats, npm data, feature comparison
   - Duration: < 30 minutes

3. **Codebase Research**
   - Topic: "How do we handle authentication?"
   - Expected: File references, pattern documentation
   - Duration: < 20 minutes

4. **Mixed Research**
   - Topic: "Should we use library X?" (requires codebase + web)
   - Expected: Current implementation + external comparison
   - Duration: < 45 minutes

### Validation Tests

1. **Broken Link Handling**
   - Provide URL that returns 404
   - Expected: ❌ FAILED status with explanation

2. **Outdated Information**
   - Claim with old date
   - Expected: ⚠️ PARTIAL with discrepancy note

3. **Exact Match**
   - Claim matching source exactly
   - Expected: ✅ VERIFIED with HIGH confidence

4. **Approximate Match**
   - Claim with rounded numbers (2.9k vs 2,947)
   - Expected: ✅ VERIFIED with explanation

---

## Risk Mitigation

### Risk: Invalid or Broken References

**Likelihood:** MEDIUM
**Impact:** MEDIUM
**Mitigation:**
- Validation phase catches broken links
- Mark as ❌ FAILED with explanation
- Attempt to find alternative sources
- Downgrade confidence level if only broken sources available

### Risk: Outdated Information

**Likelihood:** HIGH
**Impact:** LOW
**Mitigation:**
- Include verification date in all citations
- Check content age during validation
- Lower confidence for old sources
- Recommend re-verification if source > 1 year old

### Risk: Bias Toward First Results

**Likelihood:** MEDIUM
**Impact:** MEDIUM
**Mitigation:**
- Search multiple sources (not just first result)
- Cross-validate claims across sources
- Explicitly note when only one source available
- Encourage alternatives section in report

### Risk: Over-Reliance on Web Search

**Likelihood:** LOW
**Impact:** MEDIUM
**Mitigation:**
- Balance web search with codebase exploration
- Prioritize official documentation over blogs
- Verify GitHub/npm statistics from primary sources
- Include "confidence" assessment for all claims

### Risk: Validation Takes Too Long

**Likelihood:** MEDIUM
**Impact:** LOW
**Mitigation:**
- Implement parallel validation (validate multiple claims concurrently)
- Cache validation results for duplicate sources
- Offer "quick" depth option that skips detailed validation
- Set timeout limits on WebFetch operations

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Citation Management**
   - Auto-generate BibTeX citations
   - Export references in multiple formats
   - Citation conflict detection

2. **Collaborative Research**
   - Share research reports with team
   - Comment and annotate findings
   - Version history for research updates

3. **Research Templates**
   - Pre-built templates for common research types
   - Library comparison template
   - Security audit template
   - Architecture decision template

4. **Advanced Validation**
   - Screenshot validation (visual comparison)
   - API response validation (test endpoints)
   - Code execution validation (test examples)

5. **Research Assistant Mode**
   - Continuous research across multiple sessions
   - Aggregate findings from multiple queries
   - Proactive updates when sources change

---

## Implementation Estimate

**Total Effort:** 2-3 weeks for Claude Code team

### Week 1: Core Infrastructure (5-7 days)
- Skill registration and argument parsing
- Phase 1: Clarification workflow
- Phase 2: Research workflow (basic)
- Task context directory management
- Report generation (basic structure)

### Week 2: Validation Engine (5-7 days)
- Reference validation algorithm
- GitHub statistics validation
- npm package validation
- Web content validation
- Confidence scoring system

### Week 3: Polish & Testing (3-5 days)
- Error handling and edge cases
- Progress indicators and UX
- Comprehensive testing
- Documentation
- Beta testing with users

---

## Appendix

### Comparison to Existing Solutions

**vs. Manual Research:**
- 60-80% time savings
- Eliminates citation errors
- Provides persistent artifacts

**vs. Ad-hoc Claude Conversations:**
- Structured output (vs scattered findings)
- Validated claims (vs potentially unverified)
- Persistent reports (vs lost context)
- Shareable artifacts (vs conversation-only)

**vs. Perplexity/Research Tools:**
- Codebase integration (can search your code)
- Self-validation (verifies own claims)
- Developer-focused (technical topics)
- CLI integration (fits existing workflow)

### Related Work

- **Perplexity.ai** - Web research with citations (no validation, no codebase integration)
- **Elicit.org** - Academic research assistant (paper-focused, not code)
- **GitHub Copilot** - Code suggestions (no research capability)
- **Cursor Composer** - Multi-file editing (no structured research)

### Open Questions

1. Should research reports be version-controlled (git commit)?
2. Should validation be configurable (strict vs permissive)?
3. Should research be resumable across sessions?
4. Should there be a research history/archive UI?

---

**Document Status:** Ready for review and feedback

**Next Steps:**
1. Review with Claude Code team
2. Gather feedback on feasibility
3. Adjust scope based on technical constraints
4. Implement prototype for internal testing
5. Beta test with select users
6. Iterate based on feedback
7. General availability release

**Contact:** Noah Clark (clarknoah@example.com) for questions or feedback
