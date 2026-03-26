---
name: heroku-query
version: 0.1.0
description: Query Heroku infrastructure (apps, dynos, releases, config, pipelines). Use when helping users inspect Quatt's cloud runtime infrastructure on Heroku.
---

# Heroku Query via MCP

## When to Use

Use this skill when you need to:

- List Heroku apps and their status
- Inspect dyno formation (type, size, quantity, state)
- View recent releases and deployments
- Check config vars for an app
- List add-ons (Redis, Postgres, etc.)
- View pipelines and promotion history
- Investigate deployment incidents or infrastructure questions

## How to Invoke

Use the Heroku MCP tools directly. The `@heroku/mcp-server` is configured in `.mcp.json` and uses a **read-only** scoped token (`ATLAS_HEROKU_API_KEY`).

First, discover available tools:
```
ToolSearch: "heroku"
```

Then call the appropriate Heroku MCP tool.

## Security

- The token is **read-scoped** — all write operations (scale, config set, deploy) will be rejected by Heroku's API
- This is intentional — Atlas provides read-only observability into Heroku infrastructure

## Quatt's Heroku Setup

Quatt's primary cloud runtimes:

- **quatt-api** — REST API serving mobile app and support dashboard
- **quatt-worker** — Background worker consuming CIC telemetry from SQS, writing to MySQL/ClickHouse
- **quatt-timeworker** — Time-based scheduled jobs (cron-style)

> **Note:** Actual Heroku app names may differ from architecture entity names. Use the list apps tool to discover exact names.

## Common Queries

### Check deployment status
List recent releases for an app to see when the last deploy happened and who triggered it.

### Investigate an incident
1. List dynos to check if all processes are running
2. List recent releases to see if a recent deploy correlates with the issue
3. Check config vars for any recent environment changes

### Audit infrastructure
1. List all apps to get a full inventory
2. For each app, list dynos to understand the formation
3. List add-ons to see attached databases and caches

### Check pipeline promotion
List pipeline couplings to see which apps are in staging vs production.

## Troubleshooting

- **"Unauthorized" errors**: Token may have expired. Regenerate: `heroku authorizations:create --scope=read --description='Atlas read-only' --short`
- **"Forbidden" on write ops**: Expected — token is read-only by design
- **MCP server not available**: Restart Claude Code to pick up `.mcp.json` changes
