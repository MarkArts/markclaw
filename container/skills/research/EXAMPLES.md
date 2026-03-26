# `/research` Skill - Detailed Examples

**Supplement to:** RESEARCH_SKILL_DESIGN.md
**Date:** 2026-01-28

---

## Example 1: Library Comparison (Full Session)

### User Input

```bash
$ claude /research "Best RBAC library for Node.js TypeScript project"
```

### Clarification Phase

```
I'll research RBAC libraries for Node.js TypeScript projects.

Let me clarify the scope:

? Which approach do you prefer?
  ○ Compare specific libraries (Casbin, CASL, accesscontrol)
  ● Survey all popular RBAC libraries (Recommended)
  ○ Include authorization-as-a-service options (Permit.io, Cerbos)

? What's your primary concern?
  ○ Performance and scalability
  ● Developer experience and TypeScript support (Recommended)
  ○ Feature completeness (policies, attributes, conditions)
  ○ Cost and licensing

? What's your deployment context?
  ● Monolithic Node.js application (Recommended)
  ○ Microservices architecture
  ○ Serverless (AWS Lambda, etc.)

? Do you need implementation examples?
  ○ Yes, show code examples
  ● No, just recommendations and comparison (Recommended)

Great! I'll focus on:
- Survey of popular RBAC libraries for Node.js
- TypeScript support as primary criterion
- Monolithic deployment context
- Recommendations without implementation details

Starting research...
```

### Research Phase (with progress indicators)

```
🔍 Searching web for Node.js RBAC libraries...
   ✓ Found 7 popular libraries

🔍 Analyzing GitHub repositories...
   ✓ Casbin/node-casbin
   ✓ stalniy/casl
   ✓ onury/accesscontrol
   ✓ auth0/node-casbin
   ⚠ 3 others marked inactive (last update > 2 years)

🔍 Checking npm package statistics...
   ✓ Weekly downloads extracted
   ✓ TypeScript support verified
   ✓ Latest versions checked

🔍 Reviewing documentation and community feedback...
   ✓ Official docs evaluated
   ✓ Stack Overflow discussions analyzed
   ✓ Production usage examples found

📊 Validating claims...
   ✓ Verified 18/18 GitHub statistics
   ✓ Verified 12/12 npm statistics
   ✓ Verified 8/8 maintenance dates

✅ Research complete! (elapsed: 28 minutes)
```

### Validation Examples

**Claim 1: GitHub Stars**

```markdown
**Claim:** "CASL has 6.8k GitHub stars"

**Validation:**
1. Source: https://github.com/stalniy/casl
2. WebFetch result: Retrieved repository page
3. Extracted: "6,847 stars"
4. Comparison: 6,847 ≈ 6.8k ✅
5. Status: ✅ VERIFIED
6. Confidence: HIGH
7. Verified on: 2026-01-28 14:32:17 UTC
```

**Claim 2: Maintenance Status**

```markdown
**Claim:** "Casbin was last updated January 2026"

**Validation:**
1. Source: https://github.com/casbin/node-casbin
2. WebFetch result: Retrieved repository page
3. Extracted:
   - Latest release: v5.48.0 on Jan 10, 2026
   - Latest commit: Jan 15, 2026
4. Comparison: January 2026 ✅
5. Status: ✅ VERIFIED
6. Confidence: HIGH
7. Verified on: 2026-01-28 14:33:42 UTC
```

**Claim 3: TypeScript Support**

```markdown
**Claim:** "accesscontrol has TypeScript support"

**Validation:**
1. Source: https://github.com/onury/accesscontrol
2. WebFetch result: Retrieved repository page
3. Extracted:
   - Languages: "TypeScript 100%"
   - Type definitions: Found in package
4. Comparison: TypeScript support confirmed ✅
5. Status: ✅ VERIFIED
6. Confidence: HIGH
7. Verified on: 2026-01-28 14:34:15 UTC
```

**Claim 4: Maintenance Concern**

```markdown
**Claim:** "accesscontrol maintenance status is unclear"

**Validation:**
1. Source: https://github.com/onury/accesscontrol
2. WebFetch result: Retrieved repository page
3. Extracted:
   - Latest release: v3.2.0 on Mar 15, 2024
   - Latest commit: Apr 2, 2024
   - Open issues: 47
   - Open PRs: 12 (oldest from 2022)
4. Analysis:
   - Last update: 9 months ago ⚠️
   - Many unaddressed issues ⚠️
   - Old PRs suggest inactive maintenance ⚠️
5. Status: ⚠️ PARTIAL
6. Confidence: MEDIUM
7. Verified on: 2026-01-28 14:35:01 UTC
8. Note: "Unclear" is subjective; evidence suggests low activity
```

### Summary Presentation

```markdown
Research complete! Here's what I found:

## RBAC Libraries for Node.js TypeScript - Key Findings

**Recommendation:** Use CASL for TypeScript-first projects. If requirements are simple (< 5 roles, no complex policies), consider building custom RBAC instead.

**Key Insights:**
- CASL offers best TypeScript DX with 6.8k stars and active maintenance (HIGH confidence)
- Casbin is feature-rich but over-engineered for most projects (HIGH confidence)
- accesscontrol has maintenance concerns with 9-month gap in updates (MEDIUM confidence)

**Validation:** Verified 38/38 factual claims (100% verified)

**Full Report:** `./task-context/task/rbac-libraries-nodejs/research.md`

**Next Steps:**
1. If proceeding with CASL: Review official docs at https://casl.js.org/
2. If building custom: Review existing authorization middleware patterns
3. Consider POC implementation to validate fit with your architecture

Would you like me to clarify any findings or explore alternatives?
```

### Full Report (research.md)

```markdown
# Research: Best RBAC Library for Node.js TypeScript Project

**Date:** 2026-01-28
**Requested by:** Noah Clark
**Research Context:** Evaluating RBAC solutions for Quatt Cloud installer portal authentication/authorization implementation
**Validation Status:** 38/38 claims verified (100%)

## Executive Summary

After evaluating 7 RBAC libraries for Node.js, **CASL is recommended** for TypeScript-first projects requiring flexible authorization with strong type safety. It provides excellent developer experience, active maintenance (latest release Jan 2026), and comprehensive documentation. **Alternative recommendation:** Build custom RBAC if requirements are simple (< 5 roles, no complex attribute-based policies) - current codebase may already have 80% of needed functionality.

## Research Questions

1. Which Node.js RBAC libraries have strong TypeScript support?
2. Which libraries are actively maintained in 2026?
3. What are the tradeoffs between full-featured libraries vs. custom implementation?
4. Which library best fits monolithic Node.js applications?
5. What are the production usage patterns and community sentiment?

## Findings

### 1. Library Landscape

**Active Libraries (7 evaluated):**

| Library | Stars | Weekly Downloads | Last Update | TypeScript | Status |
|---------|-------|------------------|-------------|------------|--------|
| CASL | 6.8k ✅ | 180k ✅ | Jan 2026 ✅ | Native ✅ | ✅ VERIFIED |
| Casbin | 2.9k ✅ | 45k ✅ | Jan 2026 ✅ | 99.9% ✅ | ✅ VERIFIED |
| accesscontrol | 2.3k ✅ | 320k ✅ | Apr 2024 ⚠️ | 100% ✅ | ⚠️ PARTIAL |

**Inactive Libraries (3 excluded):**
- `node-acl` - Last update 2019
- `rbac` - Last update 2018
- `role-acl` - Last update 2020

### 2. Detailed Analysis

#### CASL (Recommended)

**Strengths:**
- ✅ TypeScript-first design with excellent type inference
- ✅ Actively maintained (6,847 stars, last release Jan 5, 2026)
- ✅ Flexible subject-action-resource pattern
- ✅ Framework agnostic (works with Express, Fastify, etc.)
- ✅ Well-documented with numerous examples
- ✅ Bundle size: 12.4 KB minified

**Weaknesses:**
- ⚠️ Steeper learning curve than simple role-based systems
- ⚠️ No built-in persistence layer (must implement storage)

**Best For:**
- Projects needing attribute-based access control (ABAC)
- Complex permission rules with conditions
- Multi-tenant applications
- Teams prioritizing type safety

**Production Usage:**
- Used by: Shopify, GitLab, various SaaS platforms
- Stack Overflow: 200+ questions, active community

#### Casbin (Alternative)

**Strengths:**
- ✅ Extremely feature-rich (RBAC, ABAC, RESTful, etc.)
- ✅ Actively maintained (2,947 stars, last release Jan 10, 2026)
- ✅ Policy-as-code approach with enforcement engine
- ✅ Multi-language support (Node, Python, Go, Java, etc.)
- ✅ Built-in adapters for persistence

**Weaknesses:**
- ⚠️ Over-engineered for simple use cases
- ⚠️ Steeper learning curve due to policy language
- ⚠️ Larger bundle size: ~50 KB minified
- ⚠️ Requires understanding of policy models (ACL, RBAC, ABAC)

**Best For:**
- Enterprise applications with complex policies
- Polyglot environments (multiple languages)
- Audit requirements (policy-as-code)
- Fine-grained API access control

**Production Usage:**
- Used by: Alibaba, Tencent, various enterprise projects
- Active Discord community

#### accesscontrol (Maintenance Concerns)

**Strengths:**
- ✅ Simple, intuitive API
- ✅ Good TypeScript support (100% TypeScript)
- ✅ High npm downloads (320k weekly)
- ✅ Minimal bundle size: 8.1 KB minified

**Weaknesses:**
- ⚠️ Maintenance concerns: Last update April 2024 (9 months ago)
- ⚠️ 47 open issues, 12 open PRs (oldest from 2022)
- ⚠️ Less flexible than CASL/Casbin
- ⚠️ Limited to hierarchical RBAC

**Best For:**
- Simple role hierarchies (Admin > User)
- Quick prototypes
- Projects willing to fork if needed

**Production Usage:**
- Still used in older projects
- Declining community activity

### 3. Custom Implementation Analysis

**When to Build Custom:**
- ✅ Simple role hierarchy (< 5 roles)
- ✅ No complex attribute-based rules
- ✅ Existing middleware already handles basics
- ✅ Full control over authorization logic desired

**When to Use Library:**
- ✅ Complex permission rules (conditions, attributes)
- ✅ Multi-tenant with varying permissions
- ✅ Need policy management UI
- ✅ Limited development time

**Quatt Cloud Context:**
Current codebase already has:
- Firebase authentication
- Role-based middleware (`authorizeRolesMiddleware`)
- Resource-level permissions (`installationAccessPermissionMiddleware`)
- Multi-tenant via junction tables (`userCic`, `userInstallation`)

**Verdict:** Quatt Cloud likely has 80% of needed RBAC functionality. Custom extension recommended over adopting external library.

## Recommendations

### Primary: Use CASL (if adopting library)

**Rationale:**
1. Best TypeScript developer experience
2. Active maintenance and community
3. Flexible enough for future requirements
4. Framework agnostic

**Implementation Approach:**
```typescript
import { defineAbility } from '@casl/ability';

// Define abilities based on user role
const defineAbilitiesFor = (user: User) => {
  return defineAbility((can, cannot) => {
    if (user.isAdmin) {
      can('manage', 'all');
    } else if (user.installerId) {
      can('read', 'Installation', { installerId: user.installerId });
      can('update', 'Settings', { installerId: user.installerId });
      cannot('delete', 'Installation');
    }
  });
};
```

### Alternative: Custom RBAC Extension

**Rationale:**
1. Current codebase has 80% of needed functionality
2. Simple role hierarchy (Admin > Installer > User)
3. Full control over authorization logic
4. Zero external dependencies

**Implementation Approach:**
- Extend existing middleware with tenant scoping
- Add feature-level permission helper functions
- Implement audit logging
- No library needed

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|---------|------------|
| Library abandonment | LOW | MEDIUM | Choose actively maintained (CASL, Casbin); monitor GitHub activity quarterly |
| Over-engineering | MEDIUM | LOW | Start with simplest solution; add complexity only when needed |
| Performance at scale | LOW | MEDIUM | Implement caching layer; load test with realistic data volumes |
| Learning curve | MEDIUM | LOW | Allocate time for team training; create internal examples |
| Breaking changes | LOW | MEDIUM | Pin major versions; review changelogs before upgrades |

## References

### Validated Sources

1. **[CASL GitHub Repository](https://github.com/stalniy/casl)** - ✅ VERIFIED (HIGH confidence)
   - Verified: 6,847 stars, v6.8.2 released Jan 5, 2026, TypeScript native
   - Date: 2026-01-28 14:32:17 UTC

2. **[Casbin GitHub Repository](https://github.com/casbin/node-casbin)** - ✅ VERIFIED (HIGH confidence)
   - Verified: 2,947 stars, v5.48.0 released Jan 10, 2026, 99.9% TypeScript
   - Date: 2026-01-28 14:33:42 UTC

3. **[accesscontrol GitHub Repository](https://github.com/onury/accesscontrol)** - ⚠️ PARTIAL (MEDIUM confidence)
   - Verified: 2,347 stars, v3.2.0 released Mar 15, 2024, TypeScript 100%
   - Concern: 9-month gap in updates, 47 open issues, old PRs
   - Date: 2026-01-28 14:34:15 UTC

4. **[CASL npm Package](https://www.npmjs.com/package/@casl/ability)** - ✅ VERIFIED (HIGH confidence)
   - Verified: 180k weekly downloads, v6.8.2 latest
   - Date: 2026-01-28 14:36:22 UTC

5. **[Casbin npm Package](https://www.npmjs.com/package/casbin)** - ✅ VERIFIED (HIGH confidence)
   - Verified: 45k weekly downloads, v5.48.0 latest
   - Date: 2026-01-28 14:37:08 UTC

6. **[accesscontrol npm Package](https://www.npmjs.com/package/accesscontrol)** - ✅ VERIFIED (HIGH confidence)
   - Verified: 320k weekly downloads (highest among three)
   - Date: 2026-01-28 14:37:51 UTC

### Additional Resources

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [RBAC vs ABAC Comparison](https://www.osohq.com/academy/rbac-vs-abac)

## Appendix

### Alternatives Considered and Rejected

#### Authorization-as-a-Service (Permit.io, Cerbos)

**Pros:**
- Hosted solution, no maintenance
- Policy management UI included
- Audit logs built-in

**Cons:**
- ❌ $200-500/month recurring cost
- ❌ 50-100ms latency per request
- ❌ External dependency and data privacy concerns
- ❌ Not justified for current requirements

**Verdict:** Rejected due to cost and latency concerns

#### Other Libraries Evaluated

- `node-acl` - ❌ Abandoned (last update 2019)
- `rbac` - ❌ Abandoned (last update 2018)
- `role-acl` - ❌ Abandoned (last update 2020)

### Validation Log

**Total Claims:** 38
**Verified:** 38 (100%)
**Partial:** 1 (maintenance status)
**Failed:** 0

**Validation Methods Used:**
- GitHub statistics: WebFetch + data extraction (18 claims)
- npm statistics: WebFetch + data extraction (12 claims)
- Maintenance dates: WebFetch + release/commit parsing (8 claims)

**Average Confidence:** 95% HIGH, 5% MEDIUM

### Related Context

**Quatt Cloud Codebase Files:**
- `/Users/clarknoah/Development/Quatt-cloud/src/middleware/firebase-authentication.ts`
- `/Users/clarknoah/Development/Quatt-cloud/src/shared/middleware/authorizeRolesMiddleware.ts`
- `/Users/clarknoah/Development/Quatt-cloud/src/shared/middleware/installationAccessPermissionMiddleware.ts`

**Related Jira Tickets:**
- QPD-XXXX: Installer Portal RBAC Implementation

---

**Report Generated By:** Claude Code `/research` skill v1.0
**Total Research Time:** 28 minutes
**Validation Accuracy:** 100%
```

---

## Example 2: Codebase Pattern Research

### User Input

```bash
$ claude /research "How do we handle streaming endpoints?"
```

### Clarification Phase

```
I'll research streaming endpoint patterns in the codebase.

Let me clarify what you're looking for:

? What type of information do you need?
  ○ Current implementation details (code walkthrough)
  ● Pattern documentation (how to implement new streaming endpoints) (Recommended)
  ○ Troubleshooting existing streaming issues
  ○ Performance optimization recommendations

? Should I include external best practices?
  ○ Yes, compare with industry standards
  ● No, just document our internal patterns (Recommended)

Great! I'll focus on:
- Documenting the current streaming endpoint pattern
- Providing guide for implementing new streaming endpoints
- Internal patterns only (no external comparison)

Starting research...
```

### Research Phase

```
🔍 Searching codebase for streaming implementations...
   ✓ Found 2 active streaming endpoints
   ✓ Found shared infrastructure in src/shared/services/streaming/

🔍 Analyzing streaming architecture...
   ✓ AdminSseStreamingService pattern identified
   ✓ RedisStreamRepository pattern identified
   ✓ Route handler pattern documented

🔍 Extracting code examples...
   ✓ MQTT debug stream implementation
   ✓ Device stream implementation
   ✓ Message processor interface

✅ Research complete! (elapsed: 12 minutes)
```

### Summary Presentation

```markdown
Research complete! Here's what I found:

## Streaming Endpoint Patterns - Key Findings

**Pattern:** Server-Sent Events (SSE) via shared infrastructure in `src/shared/services/streaming/`

**Key Insights:**
- All streaming uses AdminSseStreamingService + RedisStreamRepository pattern
- Two active endpoints: MQTT debug stream and device stream
- New streams should NOT create custom SSE handling

**Full Report:** `./task-context/task/streaming-endpoints/research.md`

**Quick Start for New Streaming Endpoint:**
1. Create domain service extending AdminSseStreamingService
2. Implement MessageProcessor interface
3. Register route with proper error handling

**Example Files:**
- /Users/clarknoah/Development/Quatt-cloud/src/shared/services/streaming/AdminSseStreamingService.ts
- /Users/clarknoah/Development/Quatt-cloud/src/admin/routes/mqtt-debug-stream.ts

Would you like me to generate a template for a new streaming endpoint?
```

---

## Example 3: Quick Research (Bug Context)

### User Input

```bash
$ claude /research --depth quick "Why does our timezone handling fail during DST?"
```

### Clarification Phase (Minimal)

```
Quick research mode enabled (10-15 min max).

I'll research timezone handling issues in the codebase, focusing on DST-related bugs.

Starting research...
```

### Research Phase

```
🔍 Searching codebase for timezone-related code...
   ✓ Found dayjs timezone usage in 34 files
   ✓ Identified DST-sensitive operations

🔍 Analyzing common patterns...
   ✓ Database date handling patterns
   ✓ DST transition edge cases

⚠️  Issue found: UTC dates parsed as local time

✅ Research complete! (elapsed: 8 minutes)
```

### Summary Presentation

```markdown
Research complete! Here's what I found:

## Timezone DST Handling Bug - Root Cause

**Root Cause:** Database stores UTC timestamps, but code parses them as local time using `dayjs.tz(dbDateTime, "Europe/Amsterdam")` instead of `dayjs.utc(dbDateTime).tz("Europe/Amsterdam")`

**Impact:** 2-hour discrepancies during DST transitions

**Key Issues:**
- 34 files use dayjs for timezone operations
- Common anti-pattern: `dayjs.tz(dbDateTime, "Amsterdam")`
- Correct pattern: `dayjs.utc(dbDateTime).tz("Amsterdam")`

**Full Report:** `./task-context/task/timezone-dst-bug/research.md`

**Immediate Fix:**
1. Audit all `dayjs.tz(installedAt, ...)` calls
2. Replace with `dayjs.utc(installedAt).tz(...)`
3. Add UTC plugin imports where missing

**Files to Fix:**
- /Users/clarknoah/Development/Quatt-cloud/src/tariff/services/tariffService.ts:342
- /Users/clarknoah/Development/Quatt-cloud/src/insights/services/insightsService.ts:128
- (32 more files listed in full report)

Should I create a task list to fix these issues?
```

---

## Example 4: Failed Validation Handling

### Research Extract

```markdown
## Library Comparison

| Library | Stars | Maintenance | TypeScript |
|---------|-------|-------------|------------|
| libx | ❌ Not verified | ⚠️ Unclear | ✅ Yes |

### Validation Issues

#### libx GitHub Statistics

**Claim:** "libx has 5k GitHub stars"

**Validation:**
1. Source: https://github.com/example/libx
2. WebFetch result: ❌ 404 Not Found
3. Status: ❌ FAILED
4. Confidence: N/A
5. Verified on: 2026-01-28 15:42:19 UTC

**Attempted Alternatives:**
- Searched "libx GitHub repository" → No clear results
- Checked npm package page → No GitHub link provided
- Searched "libx stars" → Found Reddit post mentioning 5k stars (unreliable)

**Recommendation:** Exclude libx from comparison due to inability to verify claims. If libx is critical to research, manual investigation required.

**Action:** Marked libx with ❌ in comparison table and noted verification failure.
```

---

## Example 5: Multi-Source Research

### User Input

```bash
$ claude /research "Should we migrate from MySQL to PostgreSQL?"
```

### Research Sources Used

```
✓ Codebase (Prisma schema analysis)
✓ Web (Migration guides, performance comparisons)
✓ GitHub (Issue tracking for Prisma + Postgres)
✓ Jira (Historical tickets about database issues)
```

### Validation Example

```markdown
**Claim:** "PostgreSQL offers better JSON performance than MySQL"

**Validation:**
1. Source: https://www.postgresql.org/docs/current/datatype-json.html
2. WebFetch result: Retrieved documentation
3. Extracted: "JSONB type provides indexable binary JSON storage"
4. Comparison with MySQL: WebFetch https://dev.mysql.com/doc/refman/8.0/en/json.html
5. Extracted: "JSON type stores as text, generated columns needed for indexing"
6. Analysis:
   - PostgreSQL: Native binary format ✅
   - PostgreSQL: Direct indexing support ✅
   - MySQL: Text-based storage ⚠️
   - MySQL: Requires generated columns for indexes ⚠️
7. Status: ✅ VERIFIED
8. Confidence: HIGH
9. Verified on: 2026-01-28 16:15:33 UTC

**Additional Context from Codebase:**
- Found 12 JSON column uses in /Users/clarknoah/Development/Quatt-cloud/prisma/schema.prisma
- No indexes on JSON columns currently
- Performance concern: `insights` table JSON queries (1.2s avg)

**Conclusion:** Claim verified. PostgreSQL's JSONB would benefit current JSON-heavy queries.
```

---

## Example 6: Research with Jira Integration

### User Input

```bash
$ claude /research "History of authentication refactoring attempts"
```

### Research Phase

```
🔍 Searching Jira for authentication-related tickets...
   ✓ Found 23 tickets mentioning "authentication" or "auth refactor"
   ✓ Filtering for closed tickets with implementation details

🔍 Analyzing codebase history...
   ✓ git log analysis for authentication changes
   ✓ File history for src/middleware/firebase-authentication.ts

🔍 Correlating Jira tickets with code changes...
   ✓ QPD-1234: Firebase migration (2023-05)
   ✓ QPD-2456: JWT token refresh (2024-02)
   ✓ QPD-3789: Multi-tenant auth (2025-11)

✅ Research complete! (elapsed: 15 minutes)
```

### Research Output Extract

```markdown
## Historical Refactoring Attempts

### Attempt 1: Firebase Migration (QPD-1234, 2023-05)

**Objective:** Migrate from custom JWT to Firebase Auth

**Outcome:** ✅ Successful

**Key Changes:**
- Replaced custom JWT middleware with Firebase verification
- Migrated user table to store Firebase UIDs
- Updated mobile app to use Firebase SDK

**Lessons Learned:**
- "Gradual migration with dual auth support worked well"
- "Mobile app migration was smoother than expected"

**Validation:**
- Jira ticket: https://quatt-team.atlassian.net/browse/QPD-1234 ✅ VERIFIED
- Commit: a1b2c3d (2023-05-15) ✅ VERIFIED
- File: /Users/clarknoah/Development/Quatt-cloud/src/middleware/firebase-authentication.ts

### Attempt 2: JWT Token Refresh (QPD-2456, 2024-02)

**Objective:** Implement automatic token refresh for mobile apps

**Outcome:** ⚠️ Partially successful (reverted some changes)

**Key Changes:**
- Added refresh token endpoint
- Implemented background token refresh in mobile app
- Had to revert due to race conditions in token rotation

**Lessons Learned:**
- "Token rotation requires careful sequencing"
- "Firebase SDK handles refresh automatically - should have used that"

**Validation:**
- Jira ticket: https://quatt-team.atlassian.net/browse/QPD-2456 ✅ VERIFIED
- Commit: d4e5f6g (2024-02-20) then revert h7i8j9k (2024-03-05) ✅ VERIFIED

[... more history ...]
```

---

## Validation Edge Cases

### Edge Case 1: Ambiguous Date Precision

**Claim:** "Library was updated recently"

**Validation Challenge:** "Recently" is subjective

**Resolution:**
```markdown
**Claim:** "Library was updated recently"

**Validation:**
1. Source: https://github.com/example/lib
2. WebFetch result: Retrieved repository page
3. Extracted: Last commit Jan 10, 2026
4. Analysis:
   - Current date: Jan 28, 2026
   - Time since update: 18 days
   - Definition of "recently" varies by context
5. Status: ⚠️ PARTIAL
6. Confidence: MEDIUM
7. Verified on: 2026-01-28
8. Note: Claim is subjective. Objective data: last update 18 days ago.

**Recommendation:** Rephrase claim as "Library was last updated January 2026 (18 days ago)"
```

### Edge Case 2: Rounded Numbers

**Claim:** "Package has 2M weekly downloads"

**Validation:**
```markdown
**Claim:** "Package has 2M weekly downloads"

**Validation:**
1. Source: https://www.npmjs.com/package/example
2. WebFetch result: Retrieved package page
3. Extracted: 1,847,392 weekly downloads
4. Comparison:
   - Claimed: 2,000,000 (2M)
   - Actual: 1,847,392 (1.8M)
   - Difference: 152,608 (8.3%)
5. Status: ⚠️ PARTIAL
6. Confidence: MEDIUM
7. Verified on: 2026-01-28
8. Note: Actual downloads (1.8M) are closer to "2M" than indicated

**Recommendation:** Update claim to "1.8M weekly downloads" for accuracy
```

### Edge Case 3: Redirect Handling

**Claim:** "Official docs are at https://example.com/docs"

**Validation:**
```markdown
**Claim:** "Official docs are at https://example.com/docs"

**Validation:**
1. Source: https://example.com/docs
2. WebFetch result: Redirect to https://docs.example.com/
3. Status: ⚠️ PARTIAL
4. Confidence: MEDIUM
5. Verified on: 2026-01-28
6. Note: URL redirects to https://docs.example.com/ (different subdomain)

**Recommendation:** Update citation to use redirected URL
```

---

## User Experience Scenarios

### Scenario 1: Interrupted Research

```
User starts research, then closes terminal

$ claude /research "Compare GraphQL vs REST for our API"
[Research in progress...]
[User closes terminal]

[Later, user opens new terminal]

$ claude /research "Compare GraphQL vs REST for our API"

Claude: I found a partial research report for this topic from earlier today.
Would you like me to:
  ○ Resume the previous research (picks up where it left off)
  ● Start fresh research (Recommended)
  ○ Review the partial findings

[User selects "Review partial findings"]

Claude: Here's what I found before the research was interrupted:

## GraphQL vs REST - Partial Findings (70% complete)

**Completed:**
- ✅ Web research on GraphQL benefits
- ✅ REST API best practices
- ✅ Validation of 12/15 claims

**Pending:**
- ⏳ Codebase analysis of current REST API
- ⏳ Performance comparison validation
- ⏳ Migration effort estimation

Would you like me to complete the remaining research?
```

### Scenario 2: Disagreement with Findings

```
$ claude /research "Should we use MongoDB for time-series data?"

[Research completes]

Claude: Research complete! Here's what I found:

Recommendation: Do NOT use MongoDB for time-series data. Use a specialized time-series database like TimescaleDB or InfluxDB instead.

User: I disagree. MongoDB has time-series collections now.

Claude: You're absolutely right - MongoDB introduced time-series collections in v5.0. Let me re-research with this context:

/research "MongoDB time-series collections for our use case"

[Updated research incorporates MongoDB 5.0+ features]

Claude: Updated research shows MongoDB time-series collections are viable for your use case. My previous recommendation was based on pre-5.0 MongoDB. Here's the updated analysis...
```

### Scenario 3: Follow-up Research

```
$ claude /research "Best state management for React"

[Research completes - recommends Zustand]

User: What about Jotai? How does it compare to Zustand?

Claude: Great question! Let me research the Zustand vs Jotai comparison specifically:

/research "Zustand vs Jotai comparison"

[Research includes references to previous research]

Claude: Building on my previous research, here's a detailed Zustand vs Jotai comparison:

**Previous Research:** Recommended Zustand for general state management
**New Finding:** Jotai is better suited for atomic state with derived values

Full report: ./task-context/task/zustand-vs-jotai/research.md

This research references findings from: ./task-context/task/react-state-management/research.md
```

---

## Performance Characteristics

### Typical Research Duration

| Research Type | Complexity | Duration | Validation Claims |
|--------------|-----------|----------|-------------------|
| Simple question | Low | 5-10 min | 2-5 |
| Library comparison | Medium | 20-30 min | 10-20 |
| Codebase pattern | Medium | 10-20 min | 0-5 (no external validation) |
| Architecture decision | High | 30-45 min | 20-40 |
| Bug investigation | Variable | 10-30 min | 5-15 |

### Tool Usage Breakdown

**Typical Library Comparison Research:**
- WebSearch: 5-8 queries
- WebFetch: 15-25 page fetches (validation)
- Task (Explore): 0-2 (if codebase relevant)
- Glob/Grep/Read: 5-10 (codebase patterns)
- Write: 1 (research.md creation)

**Estimated Token Usage:**
- Input tokens: 50k-100k (fetched content)
- Output tokens: 10k-20k (report generation)
- Total: 60k-120k tokens per research session

---

**End of Examples Document**

This document provides concrete examples of how the `/research` skill would function in practice, including validation details, edge case handling, and user experience scenarios.
