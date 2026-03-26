---
name: atlas-knowledge-base
version: 0.5.9
description: Query Quatt's platform architecture, contracts (MQTT/REST/Kafka), capabilities, hardware registry, ADRs, and projects using the atlas CLI. Use when asked about Quatt systems, how components connect, messageSpec fields, capability requirements, or architectural decisions.
---

# Quatt Platform Knowledge Base

## When to Use
Use when the user asks about:
- Quatt system architecture, data flow, service dependencies
- MessageSpec fields (CIC <-> Cloud MQTT interface definitions)
- Capability/hardware/firmware compatibility
- REST API endpoints or MQTT channel definitions
- Architecture Decision Records
- Projects, PRDs, FRDs, and associated Jira context
- Hardware terminology or product specifics
- CIC telemetry data from S3 (historical device data, debugging, analysis)
- ClickHouse time-series queries (device stats, analytics) — see `clickhouse-query` skill for details
- MySQL application database queries (users, installations, devices) — see `quatt-cloud-mysql-query` skill for details
- HubSpot CRM queries (contacts, deals, houses) — see `hubspot-query` skill for details
- Discovering what Atlas CLI/MCP tools are available for a specific service or database

## Important: Always Use Latest Version

Always invoke via `npx @quattio/atlas-cli@latest` to ensure you get the latest version.
For local atlas monorepo development: `bun packages/cli/dist/src/bin/atlas.js`

Domain terminology, hardware products, and common misconceptions are provided in the
auto-generated context file (`.claude/context/quatt-platform.md`). This skill focuses
on CLI usage — use the context file for reference data.

## Getting AI-Specific Domain Context
Architecture entities may have embedded AI context (terminology, corrections, domain tips).
Always check when working with unfamiliar entities:
```bash
npx @quattio/atlas-cli@latest query:arch:ai-context                          # All domain context
npx @quattio/atlas-cli@latest query:arch:ai-context --id=cic                 # Context for specific entity
npx @quattio/atlas-cli@latest query:arch:ai-context --type=device            # Context for all devices
```
Entity query results also include `aiContext` when available.

## How to Invoke

**From any repo** (installed from GitHub Packages):
```bash
npx @quattio/atlas-cli@latest <command>
```

**Locally in the atlas monorepo** (after building):
```bash
bun packages/cli/dist/src/bin/atlas.js <command>
```

## Credential Resolution

Data connectors resolve credentials in this order:
1. Environment variable (canonical `ATLAS_*` name first, legacy fallbacks)
2. 1Password CLI (`op read op://vault/item/field`) if available
3. Error with diagnostic guidance

Run `atlas credentials:status` to check which credentials are configured and from where.
Run `atlas credentials:sync --vault=Atlas --dry-run` to see what 1Password items would be created.

**Canonical env var names** (preferred over legacy):
| Connector | Canonical Name | Legacy Fallback |
| --- | --- | --- |
| ClickHouse (dev) | `ATLAS_CLICKHOUSE_DEV_HOST`, `ATLAS_CLICKHOUSE_DEV_PORT`, `ATLAS_CLICKHOUSE_DEV_USER`, `ATLAS_CLICKHOUSE_DEV_PASSWORD` | `CLICKHOUSE_DEVELOP_READONLY_HOST`, etc. |
| MySQL (dev) | `ATLAS_MYSQL_DEV_URL` | `MYSQL_DEVELOP_READONLY` |
| HubSpot | `ATLAS_HUBSPOT_TOKEN` | `HUBSPOT_API_TOKEN` |

## Quick Start Commands
```bash
npx @quattio/atlas-cli@latest query:overview                                    # Platform summary
npx @quattio/atlas-cli@latest query:messagespec:search --query=<text>           # Search 603 fields
npx @quattio/atlas-cli@latest query:messagespec:field --name=<name>             # Get specific field
npx @quattio/atlas-cli@latest query:arch:search --query=<text>                  # Search architecture
npx @quattio/atlas-cli@latest query:arch:entity --id=<entity-id>                # Full entity details + aiContext
npx @quattio/atlas-cli@latest query:arch:deps --id=<entity-id>                  # Get dependencies
npx @quattio/atlas-cli@latest query:arch:ai-context                             # Domain context for AI
npx @quattio/atlas-cli@latest query:capabilities:check --name=<cap>             # Check capability
npx @quattio/atlas-cli@latest query:adrs:list --status=accepted                 # List ADRs
npx @quattio/atlas-cli@latest query:projects:list                               # List all projects
npx @quattio/atlas-cli@latest query:projects:get --id=<project-id>              # Full project details
```

## Detailed Command Reference

### Overview
```bash
npx @quattio/atlas-cli@latest query:overview                                    # Platform summary with all data sources
```

### Architecture (11 commands)
```bash
npx @quattio/atlas-cli@latest query:arch:search --query=<text> [--type=<type>] [--limit=N]
npx @quattio/atlas-cli@latest query:arch:entity --id=<entity-id>
npx @quattio/atlas-cli@latest query:arch:deps --id=<entity-id> [--direction=upstream|downstream|both]
npx @quattio/atlas-cli@latest query:arch:types --type=<entity-type> [--limit=N]
npx @quattio/atlas-cli@latest query:arch:teams                                  # List all teams
npx @quattio/atlas-cli@latest query:arch:team --team=<name>                     # Entities owned by team
npx @quattio/atlas-cli@latest query:arch:trace --source=<id> --destination=<id> [--max-depth=N]
npx @quattio/atlas-cli@latest query:arch:topology [--environment=<name>]
npx @quattio/atlas-cli@latest query:arch:compact [--format=compact|json-minified] [--truncate-descriptions]
npx @quattio/atlas-cli@latest query:arch:ai-context [--id=<id>] [--type=<type>] [--limit=N]
npx @quattio/atlas-cli@latest query:arch:tools [--entity=<entity-id>]           # Discover Atlas CLI/MCP tools for entities
```

### MessageSpec (8 commands)
```bash
npx @quattio/atlas-cli@latest query:messagespec:search --query=<text> [--object=<obj>] [--limit=N]
npx @quattio/atlas-cli@latest query:messagespec:field --name=<cloudConnectorName>
npx @quattio/atlas-cli@latest query:messagespec:object --name=<objectName>
npx @quattio/atlas-cli@latest query:messagespec:enums [--name=<fieldName>]      # Enum value mappings
npx @quattio/atlas-cli@latest query:messagespec:redis --address=<int|string>
npx @quattio/atlas-cli@latest query:messagespec:modbus --slave-id=<n> --address=<n>
npx @quattio/atlas-cli@latest query:messagespec:objects                          # List all objects
npx @quattio/atlas-cli@latest query:messagespec:summary                          # Statistics
```

### Capabilities (4 commands)
```bash
npx @quattio/atlas-cli@latest query:capabilities:list
npx @quattio/atlas-cli@latest query:capabilities:check --name=<cap> [--firmware-cic=<ver>]
npx @quattio/atlas-cli@latest query:capabilities:requirements --name=<cap>
npx @quattio/atlas-cli@latest query:capabilities:available --firmware-cic=<ver> [--hardware-cic=<model>]
```

### Contracts - MQTT/REST (4 commands)
```bash
npx @quattio/atlas-cli@latest query:mqtt:channels [--query=<text>] [--tag=<tag>] [--direction=publish|subscribe]
npx @quattio/atlas-cli@latest query:mqtt:channel --topic=<topic>
npx @quattio/atlas-cli@latest query:rest:endpoints [--query=<text>] [--tag=<tag>] [--method=<GET|POST|...>]
npx @quattio/atlas-cli@latest query:rest:endpoint --operation-id=<id>
```

### ADRs (5 commands)
ADRs contain full document content — complete markdown, structured context/decision/consequences,
implementation tracking, and entity relationships. Use `query:adrs:get` to read the full document.

```bash
npx @quattio/atlas-cli@latest query:adrs:search --query=<text> [--status=<status>] [--limit=N]   # Full-text search across markdown content
npx @quattio/atlas-cli@latest query:adrs:get --id=<adr-id>                      # Full ADR with complete markdown document
npx @quattio/atlas-cli@latest query:adrs:get --number=<N>                        # Same, by ADR number
npx @quattio/atlas-cli@latest query:adrs:list [--status=<status>] [--author=<name>] [--label=<label>]  # Summary listing (id, title, status)
npx @quattio/atlas-cli@latest query:adrs:related --id=<adr-id>                   # Supersedes, superseded-by, related-to
npx @quattio/atlas-cli@latest query:adrs:affecting --entity-type=<type> --entity-id=<id>  # ADRs impacting an entity
```

Valid `--entity-type` values: `runtimes`, `databases`, `devices`, `capabilities`, `contracts`, `installations`
Valid `--status` values: `proposed`, `accepted`, `deprecated`, `superseded`, `rejected`

### Projects/PRDs/FRDs (7 commands)
```bash
npx @quattio/atlas-cli@latest query:projects:list [--status=<status>] [--phase=<phase>] [--limit=N]
npx @quattio/atlas-cli@latest query:projects:get --id=<project-id>
npx @quattio/atlas-cli@latest query:projects:search --query=<text> [--limit=N]
npx @quattio/atlas-cli@latest query:prds:list [--status=<status>] [--project=<project-id>]
npx @quattio/atlas-cli@latest query:frds:list [--status=<status>] [--project=<project-id>] [--label=<label>]
npx @quattio/atlas-cli@latest query:frds:search --query=<text> [--status=<status>] [--limit=N]
npx @quattio/atlas-cli@latest query:frds:get --id=<frd-id> | --number=<N>
```

Valid project `--status` values: `planning`, `active`, `paused`, `completed`, `cancelled`
Valid project `--phase` values: `concept`, `definition`, `implementation`, `verification`, `validation`, `release`, `completed`
Valid FRD `--status` values: `draft`, `review`, `approved`, `implemented`, `deprecated`, `rejected`

### Repositories (4 commands)
`query:repo:list` works without `gh`. The other 3 require the GitHub CLI (`gh`) installed and authenticated.

```bash
npx @quattio/atlas-cli@latest query:repo:list [--team=<name>]                  # List all repos with branches, URLs, teams
npx @quattio/atlas-cli@latest query:repo:search --query=<text> [--repo=<name>] [--language=<lang>] [--limit=N]  # Search code via gh
npx @quattio/atlas-cli@latest query:repo:file --repo=<name> --path=<path> [--branch=<name>]                     # Read file from GitHub
npx @quattio/atlas-cli@latest query:repo:tree --repo=<name> [--branch=<name>] [--path=<prefix>]                 # Directory tree from GitHub
```

### Visualization
```bash
npx @quattio/atlas-cli@latest visualize                                        # Serve interactive architecture visualizer
npx @quattio/atlas-cli@latest visualize --port=4000                            # Use custom port
npx @quattio/atlas-cli@latest visualize --no-browser                           # Don't auto-open browser
```

### Credential Management (2 commands)
```bash
npx @quattio/atlas-cli@latest credentials:status [--env=<environment>]         # Show credential health for all data connectors
npx @quattio/atlas-cli@latest credentials:sync [--vault=Atlas] [--dry-run]     # Provision 1Password vault items from architecture
```

### Data: ClickHouse (1 command)
Executes read-only SQL queries against ClickHouse. Requires credentials (ATLAS_CLICKHOUSE_DEV_* or legacy CLICKHOUSE_DEVELOP_READONLY_* env vars, or 1Password).
See the dedicated `clickhouse-query` skill for schema discovery, key tables, and query examples.

Valid `--env` values: `develop`, `development` (alias for develop), `staging`, `testing`, `production`

```bash
npx @quattio/atlas-cli@latest data:clickhouse:query --env=<develop|development|staging|testing|production> --query="<sql>" \
  [--timeout=<ms>] [--format=json|csv|ndjson] [--output=<path>]
```

### Data: MySQL (1 command)
Executes read-only SQL queries against the Quatt Cloud MySQL database. Requires credentials (ATLAS_MYSQL_DEV_URL or legacy MYSQL_DEVELOP_READONLY env var, or 1Password).
See the dedicated `quatt-cloud-mysql-query` skill for schema discovery, key tables, and query examples.

Valid `--env` values: `develop`, `development` (alias for develop), `staging`, `testing`, `production`

```bash
npx @quattio/atlas-cli@latest data:quatt-cloud-mysql:query --env=<develop|development|staging|testing|production> --query="<sql>" \
  [--format=json|csv|ndjson] [--output=<path>]
```

### Data: HubSpot (1 command)
Executes read-only API requests against HubSpot CRM. Requires credentials (ATLAS_HUBSPOT_TOKEN or legacy HUBSPOT_API_TOKEN env var, or 1Password).
See the dedicated `hubspot-query` skill for endpoints, search syntax, and property discovery.

```bash
npx @quattio/atlas-cli@latest data:hubspot:query --method=<GET|POST> --path="<api-path>" \
  [--body='<json>'] [--format=json|csv|ndjson] [--output=<path>]
```

### Data: S3 Data Lake (1 command)
Queries CIC telemetry data from Quatt's S3 buckets. Requires AWS CLI + SSO credentials.

**Prerequisites:**
1. Install AWS CLI: `brew install awscli` (macOS) or see https://aws.amazon.com/cli/
2. Configure SSO (one-time): `aws configure sso`
3. Authenticate (per session): `aws sso login --profile sso-production`

```bash
npx @quattio/atlas-cli@latest data:s3:query-cic \
  --cic-id=<id> --cloud=<env> --start-date=YYYY-MM-DD --end-date=YYYY-MM-DD \
  [--cic-ids=<ids>] [--objects=<list>] [--properties=<json>] [--format=json|csv|ndjson] \
  [--bucket=<name>] [--profile=<name>] [--region=<name>] [--limit=N] [--summary] \
  [--output=<path>]
```

Profile mapping: `production` → `sso-production`, `staging` → `sso-staging`, `development` → `develop`

### Data: Jira (1 command)
Executes read-only API requests against Jira. Requires credentials (ATLAS_JIRA_* env vars, or 1Password).

```bash
npx @quattio/atlas-cli@latest data:jira:query --method=<GET|POST> --path=<api_path> \
  [--body=<json>] [--format=<json|csv|ndjson>] [--output=<file>]
```

### Data: Zendesk (1 command)
Executes read-only API requests against Zendesk. Requires credentials (ATLAS_ZENDESK_* env vars, or 1Password).

```bash
npx @quattio/atlas-cli@latest data:zendesk:query --method=<GET|POST> --path=<api_path> \
  [--body=<json>] [--format=<json|csv|ndjson>] [--output=<file>]
```

### Data: Slite (1 command)
Executes read-only API requests against Slite. Requires credentials (ATLAS_SLITE_TOKEN env var, or 1Password).

```bash
npx @quattio/atlas-cli@latest data:slite:query --method=<GET|POST> --path=<api_path> \
  [--body=<json>] [--format=<json|csv|ndjson>] [--output=<file>]
```

### Data: HiBob (1 command)
Executes read-only API requests against HiBob HR. Requires credentials (ATLAS_HIBOB_* env vars, or 1Password).

```bash
npx @quattio/atlas-cli@latest data:hibob:query --method=<GET|POST> --path=<api_path> \
  [--body=<json>] [--format=<json|csv|ndjson>] [--output=<file>]
```

## Common Workflows

### Understanding an unfamiliar entity
1. `npx @quattio/atlas-cli@latest query:arch:entity --id=<id>` - Get details + aiContext
2. `npx @quattio/atlas-cli@latest query:arch:deps --id=<id>` - What connects to it
3. `npx @quattio/atlas-cli@latest query:arch:ai-context --id=<id>` - Domain-specific tips

### Finding messageSpec fields
1. `npx @quattio/atlas-cli@latest query:messagespec:search --query=<text>` - Search by keyword
2. `npx @quattio/atlas-cli@latest query:messagespec:object --name=<obj>` - All fields for an object
3. `npx @quattio/atlas-cli@latest query:messagespec:enums --name=<field>` - Enum value mappings

### Checking capability support
```bash
npx @quattio/atlas-cli@latest query:capabilities:check --name=<cap> --firmware-cic=<ver>
```

### Tracing data flow
```bash
npx @quattio/atlas-cli@latest query:arch:trace --source=<id> --destination=<id>
```

### Researching architectural decisions
1. `query:adrs:search --query=<topic>` — Full-text search across all ADR markdown content
2. `query:adrs:get --id=<adr-id>` — Read the complete ADR document (context, decision, consequences, full markdown)
3. `query:adrs:related --id=<adr-id>` — Find superseding or related decisions
4. `query:adrs:affecting --entity-type=runtimes --entity-id=quatt-api` — Find all ADRs that impact a specific component

### Integrations (5 query + 1 install commands)
```bash
npx @quattio/atlas-cli@latest query:integrations:list                          # List entities with MCPs/skills
npx @quattio/atlas-cli@latest query:integrations:entity --id=<entity-id>       # Get integrations for entity
npx @quattio/atlas-cli@latest query:integrations:mcp-servers                   # List all MCP server configs
npx @quattio/atlas-cli@latest query:integrations:skills                        # List all skill definitions
npx @quattio/atlas-cli@latest query:integrations:export-mcp                    # Export in .mcp.json format
npx @quattio/atlas-cli@latest integrations:install --id=<id>                   # Install MCPs + skills for entity
npx @quattio/atlas-cli@latest integrations:install --all                       # Install all integrations
npx @quattio/atlas-cli@latest integrations:install --all --dry-run             # Preview install
```

### Getting project context
1. `query:projects:list --status=active` — See all active projects
2. `query:projects:get --id=<id>` — Full project details (ADRs, PRDs, FRDs, affected entities, Jira key)
3. `query:prds:list --project=<id>` — PRDs for a project
4. `query:frds:list --project=<id>` — FRDs for a project

### Discovering available integrations
1. `npx @quattio/atlas-cli@latest query:integrations:list` - See which entities have MCP servers or skills
2. `npx @quattio/atlas-cli@latest query:integrations:entity --id=jira` - Get MCP config + skill for Jira
3. `npx @quattio/atlas-cli@latest integrations:install --id=jira` - Install Jira's MCP server + skills

### Searching code across Quatt repos
1. List repos: `npx @quattio/atlas-cli@latest query:repo:list` — see all repos, branches, teams
2. Search code: `npx @quattio/atlas-cli@latest query:repo:search --query=messageSpec` — search across all repos
3. Scope to repo: `npx @quattio/atlas-cli@latest query:repo:search --query=messageSpec --repo=quatt-cloud`
4. Browse tree: `npx @quattio/atlas-cli@latest query:repo:tree --repo=quatt-cloud --path=src/`
5. Read file: `npx @quattio/atlas-cli@latest query:repo:file --repo=quatt-cloud --path=package.json`

Note: search/file/tree commands require `gh` CLI. Branch defaults to the repo's QAS-declared default branch.

### Querying CIC telemetry data
1. Authenticate: `aws sso login --profile sso-production`
2. Quick check with summary: `npx @quattio/atlas-cli@latest data:s3:query-cic --cic-id=CIC-xxx --cloud=production --start-date=2026-02-01 --end-date=2026-02-01 --summary`
3. Full query: `npx @quattio/atlas-cli@latest data:s3:query-cic --cic-id=CIC-xxx --cloud=production --start-date=2026-02-01 --end-date=2026-02-01`
4. Filter by cloudConnectorObject: Add `--objects=hp1,qc,system,boiler` (use `query:messagespec:objects` to list available names)
5. Filter by individual fields: Add `--properties='{"hp1":["temperatureWaterIn","temperatureWaterOut"]}'`
6. Export to file: Add `--output=data.json` or `--format=csv --output=data.csv`
7. Multiple CICs: Use `--cic-ids=CIC-AAA,CIC-BBB` instead of `--cic-id`

### Discovering what Atlas can query for an entity
Entity queries now include `atlasAccess` — Atlas MCP tools and CLI commands mapped to that entity.
1. `npx @quattio/atlas-cli@latest query:arch:entity --id=skedulo` — Entity details include atlasAccess tools
2. `npx @quattio/atlas-cli@latest query:arch:tools --entity=skedulo` — Dedicated tool discovery
3. `npx @quattio/atlas-cli@latest query:arch:tools` — All entity→tool mappings

## Interpreting Results
- Entity results include `aiContext` array when available - read these for domain corrections
- MessageSpec fields: `redisAddressInt` is the Redis key, `cloudConnectorObject` groups fields
- Capabilities: `available: false` + `blockers` array explains what's missing
- ADRs: `query:adrs:get` returns full document with `markdown` (complete text), `context`, `decision`, `consequences`, `affects`, and `implementation` fields. `query:adrs:list` returns only summaries.
- Integrations: entities can define `mcpServers` and `skills` for AI agent access
- Projects: `query:projects:get` returns full entity with `adrs`, `prds`, `frds`, `affects`, `jiraKey`, lifecycle `phase` and `projectStatus`
- S3 data: `data:s3:query-cic` returns `metadata` (cicIds, dates, bucket, totalFiles, totalRecords) and `records` (flattened stats with `time`, `cicId`, and data fields like `hp1_temperatureWaterIn`). Use `--summary` for metadata only.
- All output is JSON for easy parsing
