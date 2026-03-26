---
name: skedulo-query
version: 0.1.0
description: Query Quatt's Skedulo scheduling data (jobs, resources, allocations). Use when helping users look up installation schedules, installer assignments, or job details.
---

# Skedulo Query via Atlas

## When to Use

Use this skill when you need to:

- Look up installation jobs and their schedules
- Query installer (resource) assignments
- Check job allocations and availability
- Get scheduling data for planning
- Investigate scheduling issues

## How to Invoke

**MCP tool** (preferred — available in Slack bot and Claude Code):
```
query_skedulo(method: "POST", path: "/graphql/graphql", body: {"query": "..."})
```

**CLI** (available in terminal):
```bash
atlas data:skedulo:query --method=GET --path="/auth/whoami"
atlas data:skedulo:query --method=POST --path="/graphql/graphql" \
  --body='{"query":"{ jobs(first: 10) { edges { node { UID Name } } } }"}'
```

CLI options:
- `--method` — HTTP method: GET or POST (required)
- `--path` — Skedulo API path (required)
- `--body` — Request body for POST (JSON string)
- `--format` — Output format: json, csv, or ndjson (default: json)
- `--output` — Write output to file instead of stdout

## Security

- Only **GET and POST** methods are allowed
- PUT, PATCH, DELETE are blocked to prevent writes
- **GraphQL mutations and subscriptions are blocked** at the client level — even though both use `POST /graphql/graphql`, the client parses the query string and rejects mutation/subscription operations before sending the request
- Auth uses Bearer token

## GraphQL Queries

Skedulo primarily uses GraphQL. Use `POST /graphql/graphql` with a query body.

### List Jobs
```
query_skedulo(
  method: "POST",
  path: "/graphql/graphql",
  body: {
    "query": "{ jobs(first: 10, orderBy: \"CreatedDate DESC\") { edges { node { UID Name Description Start End Duration Type JobStatus } } } }"
  }
)
```

### Get a Specific Job
```
query_skedulo(
  method: "POST",
  path: "/graphql/graphql",
  body: {
    "query": "{ jobsById(UID: \"job-uid-here\") { UID Name Description Start End Duration Type JobStatus JobAllocations { edges { node { Resource { Name } } } } } }"
  }
)
```

### List Resources (Installers)
```
query_skedulo(
  method: "POST",
  path: "/graphql/graphql",
  body: {
    "query": "{ resources(first: 10) { edges { node { UID Name Email PrimaryPhone Category } } } }"
  }
)
```

### Get Job Allocations
```
query_skedulo(
  method: "POST",
  path: "/graphql/graphql",
  body: {
    "query": "{ jobAllocations(first: 10, filter: \"Status == 'Confirmed'\") { edges { node { UID JobId ResourceId Status Resource { Name } Job { Name Start End } } } } }"
  }
)
```

### Schema Discovery
```
query_skedulo(
  method: "POST",
  path: "/graphql/graphql",
  body: {
    "query": "{ __schema { types { name fields { name type { name } } } } }"
  }
)
```

## REST Endpoints

### Current User Info
```
query_skedulo(method: "GET", path: "/auth/whoami")
```

## Setup Requirements

Requires credential (resolved in order):
1. Environment variable: `ATLAS_SKEDULO_TOKEN` (canonical) or `SKEDULO_API_TOKEN` (legacy fallback)
2. 1Password: `op://Atlas/Skedulo/token`
3. Error with setup instructions

```bash
ATLAS_SKEDULO_TOKEN=your_bearer_token_here
```

**Diagnostics:** Run `atlas credentials:status` to check credential availability and resolution.
**Sync from 1Password:** Run `atlas credentials:sync` to populate `.env` from 1Password vault.
