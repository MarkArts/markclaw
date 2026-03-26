---
name: architecture-refinement
description: Scan repository source code to find missing architecture entities and relationships, then generate the qas.ts files to close gaps. Use when asked to audit architecture accuracy, add missing dependencies, or refine Atlas entities.
argument-hint: <repo-name or "all">
---

# Architecture Refinement: $ARGUMENTS

You are an architecture operator. Your goal is to systematically compare what Atlas tracks against what actually exists in source code, then **generate the qas.ts files** to close every gap.

## Phase 1: Scope Selection

**Input:** `$ARGUMENTS` — either a single repo name (e.g., `quatt-cloud`) or `all`.

### Single Repo Mode

1. Verify the clone exists:
   ```
   ls architecture/repositories/$ARGUMENTS/repo/
   ```
2. Read the repo's `qas.ts` to find what runtimes it `.produces()`:
   ```
   Read architecture/repositories/$ARGUMENTS/qas.ts
   ```
3. Detect the tech stack by checking for `package.json`, `pyproject.toml`, `CMakeLists.txt`, etc.
4. For each produced runtime, note its ID — you will analyze each runtime's production instance separately.

### All Repos Mode

1. Glob for all cloned repos:
   ```
   Glob architecture/repositories/*/repo/package.json
   ```
2. For each repo with a clone, spawn a **parallel Task agent** (`subagent_type: general-purpose`) to perform Phases 2–6 independently. Pass the full skill instructions and the repo name to each agent.
3. Group repos into batches of ~5 if there are many, to avoid overwhelming context.
4. Collect all agent outputs and merge into a combined report.

**Proceed to Phase 2 for each repo/runtime in scope.**

---

## Phase 2: Gather Atlas Current State

For each produced runtime, gather what Atlas currently knows.

### 2a. Get runtime instance connections

```bash
npx @quattio/atlas-cli@latest query:arch:deps --id=<runtime-id>-production --direction=both
```

This returns upstream and downstream connections. Record them all — these are the "verified" connections.

If the production instance doesn't exist yet, check for other instances:
```bash
npx @quattio/atlas-cli@latest query:arch:entity --id=<runtime-id>
```

### 2b. Get all known services and databases

```bash
npx @quattio/atlas-cli@latest query:arch:types --type=external-service
npx @quattio/atlas-cli@latest query:arch:types --type=database
```

Build a lookup map of `entityId → name` for all known services and databases. You'll match code imports against this list in Phase 4.

### 2c. Get inter-service runtimes

```bash
npx @quattio/atlas-cli@latest query:arch:types --type=runtime
```

Record all known Quatt runtimes so you can detect inter-service connections.

---

## Phase 3: Scan Source Code

Navigate to the repo clone and scan for external service usage. Strategies differ by language.

### TypeScript / Node.js

Perform these scans in parallel where possible:

**1. Package dependencies**
```
Read architecture/repositories/<repo>/repo/package.json
```
Extract `dependencies` (production) and `devDependencies` (flag as test-only). Match against the service mapping table below.

**2. Service client imports**

Grep for SDK and client library imports. Run these in parallel:

```
Grep pattern="@aws-sdk" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="firebase-admin" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="@sentry" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="@slack" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="ioredis|redis" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="mysql2|knex|typeorm|sequelize|prisma" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="@clickhouse" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="kafkajs|@kafka" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="snowflake-sdk" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="@statsig" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="@hubspot" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="stripe" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="@axiomhq|axiom" path=architecture/repositories/<repo>/repo/ type=ts
Grep pattern="ssh2-sftp-client|sftp|SFTPClient" path=architecture/repositories/<repo>/repo/ type=ts
```

**3. Environment variables** (reveals hidden service connections)
```
Grep pattern="process\.env\." path=architecture/repositories/<repo>/repo/ type=ts output_mode=content
```
Look for env vars like `SLACK_*`, `SQS_*`, `SNOWFLAKE_*`, `STATSIG_*`, `STRIPE_*`, etc.

Also check for `.env.example`, `.env.sample`, or `.env.template` files:
```
Glob pattern="**/.env*" path=architecture/repositories/<repo>/repo/
```

**4. HTTP client calls to external URLs**
```
Grep pattern="https?://[a-zA-Z]" path=architecture/repositories/<repo>/repo/src/ type=ts output_mode=content
```
Look for base URLs to external APIs.

**5. Internal service-to-service calls**
```
Grep pattern="fetch|axios|got\.get|got\.post|request\(" path=architecture/repositories/<repo>/repo/src/ type=ts
```
Cross-reference target URLs with known Quatt runtime endpoints.

### Python

```
Read architecture/repositories/<repo>/repo/pyproject.toml
Grep pattern="^import |^from " path=architecture/repositories/<repo>/repo/ type=py output_mode=content
Grep pattern="os\.environ|os\.getenv" path=architecture/repositories/<repo>/repo/ type=py output_mode=content
```

Match against: `boto3` (AWS), `firebase_admin`, `sentry_sdk`, `slack_sdk`, `redis`, `pymysql`, `clickhouse_connect`, `kafka`, `snowflake.connector`, `statsig`, etc.

### C / C++

```
Grep pattern="#include" path=architecture/repositories/<repo>/repo/ glob="*.{h,c,cpp,hpp}"
Read architecture/repositories/<repo>/repo/CMakeLists.txt
```

### Service Mapping Table

Use this to map discovered imports/packages to Atlas entity IDs:

| Package / Import Pattern | Atlas Entity ID | Entity Type |
|---|---|---|
| `@aws-sdk/client-sqs`, `sqs` env vars | `aws-sqs` | external-service |
| `@aws-sdk/client-s3` | `aws-s3` | external-service |
| `@aws-sdk/client-iot-data-plane` | `aws-iot-core` | external-service |
| `@aws-sdk/client-athena` | `aws-athena` | external-service |
| `firebase-admin` | `firebase` | external-service |
| `@sentry/node`, `@sentry/*` | `sentry` | external-service |
| `@slack/web-api`, `@slack/bolt` | `slack` | external-service |
| `ioredis`, `redis` | `redis` | database |
| `mysql2`, `knex` (mysql), `typeorm` (mysql), `prisma` | `mysql` | database |
| `@clickhouse/client` | `clickhouse` | database |
| `kafkajs`, `@kafka/*` | `aws-msk` | external-service |
| `snowflake-sdk` | `snowflake` | external-service |
| `@statsig/node-server-sdk`, `statsig-node` | `statsig` | external-service |
| `@hubspot/api-client` | `hubspot` | external-service |
| `stripe` | `stripe` | external-service |
| `@axiomhq/js`, `axiom` | `axiom` | external-service |
| `ssh2-sftp-client` | check context | external-service |
| `mender` client calls | `mender` | external-service |
| `zuper` client calls | `zuper` | external-service |
| `clerk`, `@clerk/*` | `clerk` | external-service |
| `docupilot` | `docupilot` | external-service |

**If an import doesn't match this table**, investigate what service it connects to. It may be a new entity that needs to be created.

**Multi-runtime repos**: If a repo produces multiple runtimes (e.g., `quatt-cloud` produces `quatt-api`, `quatt-worker`, `quatt-timeworker`), you must determine which runtime each service connection belongs to. Look at:
- Directory structure (e.g., `src/api/`, `src/worker/`, `src/timeworker/`)
- Import chains — which entry point imports the service client
- Shared services that multiple runtimes use (attribute to all)

---

## Phase 4: Compare & Classify Gaps

For each service/database connection found in source code:

1. Check if the target entity exists in Atlas (from Phase 2b lookup)
2. Check if a relationship connecting the runtime instance to that entity exists (from Phase 2a)
3. Classify the gap

### Gap Classification

| Code | Type | Description |
|---|---|---|
| `MR` | Missing Relationship | Entity exists in Atlas, but no connection to this runtime |
| `MER` | Missing Entity + Relationship | Service/DB not tracked in Atlas at all |
| `MIC` | Missing Inter-service Connection | Connection between two Quatt runtimes not tracked |
| `SR` | Stale Relationship | Atlas tracks a connection but no code evidence found |

### Classification Rules

- **Test-only dependencies** (`devDependencies`, test helpers, `__tests__/` imports): Flag but do NOT report as gaps. Note them separately.
- **Transitive dependencies** (connection via shared library, not direct): Note the indirection but still report the gap if the runtime ultimately connects to the service.
- **Build-time dependencies** (webpack plugins, babel, linters): Skip entirely.
- **Production-canonical**: Focus on production instance connections. Development/staging differences are lower priority.

---

## Phase 5: Summary Report

Present a concise summary to the user before proceeding to implementation:

```markdown
## Refinement Summary for <repo-name>

**Runtime(s):** <list>
**Verified connections:** <count>
**Gaps found:** <count>

### Gaps to Close

| # | Type | Target Entity | Protocol | Evidence |
|---|------|---------------|----------|----------|
| 1 | MR   | sentry        | HTTPS    | @sentry/node in package.json |
| 2 | MER  | referral-rock | HTTPS    | src/services/referral-rock/ |
| ...

### Stale Connections (investigate)

| Connection | Notes |
|------------|-------|
| ... | No code evidence found |
```

Ask the user: **"Proceed with generating qas.ts files for these gaps?"**

If the user confirms, proceed to Phase 6. If the user wants to exclude specific gaps, note them and skip those.

---

## Phase 6: Generate Architecture Files

For each gap, generate the appropriate `qas.ts` files. Follow these patterns exactly.

### Determining Singleton vs Instance Pattern

Before creating relationships, check if the target service uses instances:

```bash
ls architecture/services/<service>/instances/ 2>/dev/null
```

- **If the `instances/` directory exists** (e.g., Firebase, Sentry, Axiom): use `entityId.serviceInstance("<service>-production")`
- **If no `instances/` directory** (e.g., Slack): use `entityId.externalService("<service>")`

Similarly for databases:
```bash
ls architecture/databases/<database>/instances/ 2>/dev/null
```
- Use `entityId.databaseInstance("<database>-production")` when instances exist
- Use `entityId.database("<database>")` when they do not

### 6a. Missing Relationship (MR) — Add Connection to Existing Entity

The connection goes in the runtime's production instance file:
`architecture/runtimes/<runtime>/instances/production/qas.ts`

Read the existing file first:
```
Read architecture/runtimes/<runtime>/instances/production/qas.ts
```

Add a new `createConnectsTo` call following the existing pattern in the file. Use the next sequential variable name (e.g., if the file has `conn1` through `conn8`, add `conn9`).

```typescript
const connN = createConnectsTo(
  "runtime-<runtime>-production-to-<service>",
  entityId.runtimeInstance("<runtime>-production"),
  entityId.serviceInstance("<service>-production"),  // OR entityId.externalService("<service>")
  { protocol: "<HTTPS|TCP|HTTP>", description: `<What the runtime does with this service>` }
);
```

Then add `connN` to the `relationships` array in the architecture export.

### 6b. Missing Entity + Relationship (MER) — Create New Entity Then Connect

**Step 1: Create the service entity.**

**Singleton service** (no per-environment config needed):

Create `architecture/services/<service-id>/qas.ts`:

```typescript
import { externalService, createDeployedIn, entityId, type QASArchitecture } from "@quattio/qas-model";

const svc = externalService("<service-id>")
  .name("<Service Name>")
  .description("<What this service does>")
  .category("<category>")  // communication, monitoring, analytics, payment, authentication, etc.
  .build();

const deployProduction = createDeployedIn(
  "deploy-service-<service-id>-production",
  entityId.environment("production"),
  [entityId.externalService("<service-id>")],
  "<Service Name> deployed in production environment"
);

const architecture: QASArchitecture = {
  entities: [svc],
  relationships: [deployProduction],
};

export default architecture;
```

**Instance service** (per-environment config needed):

Create `architecture/services/<service-id>/qas.ts` for the definition AND `architecture/services/<service-id>/instances/production/qas.ts` for the instance.

Service definition:
```typescript
import { externalService, type QASArchitecture } from "@quattio/qas-model";

const svc = externalService("<service-id>")
  .name("<Service Name>")
  .description("<What this service does>")
  .category("<category>")
  .build();

const architecture: QASArchitecture = {
  entities: [svc],
  relationships: [],
};

export default architecture;
```

Instance:
```typescript
import { serviceInstance, createDeployedIn, entityId, type QASArchitecture } from "@quattio/qas-model";

const instance = serviceInstance("<service-id>-production")
  .name("<Service Name> (Production)")
  .description("<Production instance description>")
  .service("<service-id>")
  .environment("production")
  .build();

const deployment = createDeployedIn(
  "deploy-<service-id>-production",
  entityId.environment("production"),
  [entityId.serviceInstance("<service-id>-production")],
  "<Service Name> (Production) deployed in production environment"
);

const architecture: QASArchitecture = {
  entities: [instance],
  relationships: [deployment],
};

export default architecture;
```

**Step 2: Add the relationship** in the runtime's production instance `qas.ts` (same as MR pattern in 6a).

### 6c. Missing Inter-service Connection (MIC) — Connect Two Runtimes

Add a `createConnectsTo` in the calling runtime's production instance file:

```typescript
const connN = createConnectsTo(
  "runtime-<caller>-production-to-<target>-production",
  entityId.runtimeInstance("<caller>-production"),
  entityId.runtimeInstance("<target>-production"),
  { protocol: "<HTTPS|TCP|gRPC>", description: `<What the caller does with the target>` }
);
```

### 6d. After All Files Are Created/Updated

Run the aggregation script to update `architecture/index.ts` with any new imports:

```bash
bun run scripts/aggregate-qas.ts
```

---

## Phase 7: Validate

Run validation to ensure everything compiles and passes:

```bash
# Quick check — type safety
bunx tsc --noEmit

# Build all packages
bun run build

# Full CI (gold standard)
bun run ci:local
```

If validation fails:
1. Read the error messages carefully
2. Common issues:
   - **Duplicate relationship IDs**: Each relationship ID must be globally unique. Use the pattern `runtime-<runtime>-production-to-<service>`
   - **Missing entity reference**: The target entity ID must match an entity that exists in the graph. Run `npx @quattio/atlas-cli@latest query:arch:entity --id=<id>` to verify
   - **Import not in index.ts**: Re-run `bun run scripts/aggregate-qas.ts`
3. Fix and re-validate

Once `bun run ci:local` passes, the refinement is complete.

---

## Important Notes

- **Never modify code inside `architecture/repositories/*/repo/`** — those are cloned repos, read-only for analysis.
- **Exclude `node_modules/`, `dist/`, `.next/`, `build/`** from grep scans — only scan source code.
- **Multi-runtime awareness**: A single repo can produce multiple runtimes. Attribute each connection to the correct runtime based on import chains and directory structure.
- **Be conservative with SR (Stale Relationship)**: A connection might exist via configuration, env vars, or indirect SDK usage that isn't obvious from import scanning. Only flag as stale if you're confident the connection is no longer active.
- **Source file paths**: Always include relative paths from the repo root as evidence for each finding.
- **Entity IDs must be kebab-case**: e.g., `referral-rock`, not `referralRock` or `ReferralRock`.
- **Relationship IDs must be unique**: Follow the naming convention `runtime-<runtime>-production-to-<target>` to avoid collisions.
