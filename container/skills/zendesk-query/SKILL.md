---
name: zendesk-query
version: 0.5.8
description: Query Quatt's Zendesk Support data (tickets, users, organizations). Use when helping users look up support tickets, customer info, or investigate CS issues.
---

# Zendesk Query via Atlas

## When to Use

Use this skill when you need to:

- Look up support tickets in Zendesk
- Search for tickets by status, assignee, or keyword
- Get customer/user information from Zendesk
- Query organization data
- Discover available ticket fields (schema discovery)
- Investigate customer support issues

## How to Invoke

**MCP tool** (preferred — available in Slack bot and Claude Code):
```
query_zendesk(method: "GET", path: "/api/v2/tickets/123")
```

### CLI Command
```bash
atlas data:zendesk:query --method=GET --path="/api/v2/tickets/123"
atlas data:zendesk:query --method=GET --path="/api/v2/search.json?query=type:ticket status:open"
```

## Security

- Only **GET and POST** methods are allowed
- PUT, PATCH, DELETE are blocked to prevent writes
- Auth uses Zendesk API token (Basic Auth with email/token:{token})

## Discovering Schemas at Runtime

**Do NOT memorize Zendesk field names.** Instead, discover them at runtime:

```
# List all ticket fields
query_zendesk(method: "GET", path: "/api/v2/ticket_fields")

# List all user fields
query_zendesk(method: "GET", path: "/api/v2/user_fields")

# List all organization fields
query_zendesk(method: "GET", path: "/api/v2/organization_fields")
```

## Common Endpoints

### Get a Ticket
```
query_zendesk(method: "GET", path: "/api/v2/tickets/123")
```

### Search Tickets
```
# Search by status
query_zendesk(method: "GET", path: "/api/v2/search.json?query=type:ticket status:open")

# Search by keyword
query_zendesk(method: "GET", path: "/api/v2/search.json?query=type:ticket heating issue")

# Search by assignee
query_zendesk(method: "GET", path: "/api/v2/search.json?query=type:ticket assignee:user@quatt.io")
```

### Get User
```
query_zendesk(method: "GET", path: "/api/v2/users/123")
```

### Search Users
```
query_zendesk(method: "GET", path: "/api/v2/search.json?query=type:user email:customer@example.com")
```

### Get Organization
```
query_zendesk(method: "GET", path: "/api/v2/organizations/123")
```

### List Recent Tickets
```
query_zendesk(method: "GET", path: "/api/v2/tickets/recent?per_page=10")
```

## Search Query Syntax

Zendesk search uses a query string format:
- `type:ticket` — filter by object type
- `status:open` — filter by status (new, open, pending, hold, solved, closed)
- `priority:high` — filter by priority
- `assignee:email` — filter by assignee
- `created>2026-01-01` — date filters
- Combine with spaces for AND logic

## Setup Requirements

Requires credentials (resolved in order):
1. Environment variables: `ATLAS_ZENDESK_SUBDOMAIN` (canonical) or `ZENDESK_SUBDOMAIN` (legacy fallback), `ATLAS_ZENDESK_EMAIL` (canonical) or `ZENDESK_USER_EMAIL` (legacy fallback), `ATLAS_ZENDESK_TOKEN` (canonical) or `ZENDESK_API_TOKEN` (legacy fallback)
2. 1Password: `op://Atlas/Zendesk/subdomain`, `op://Atlas/Zendesk/email`, `op://Atlas/Zendesk/token`
3. Error with setup instructions

```bash
ATLAS_ZENDESK_SUBDOMAIN=quatt
ATLAS_ZENDESK_EMAIL=service-account@quatt.io
ATLAS_ZENDESK_TOKEN=your_token_here
```

**Diagnostics:** Run `atlas credentials:status` to check credential availability and resolution.
**Sync from 1Password:** Run `atlas credentials:sync` to populate `.env` from 1Password vault.
