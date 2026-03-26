---
name: hibob-query
version: 0.5.8
description: Query Quatt's HiBob HR data (employees, org structure, time off). Use when helping users look up employee info, team structure, or HR data.
---

# HiBob Query via Atlas

## When to Use

Use this skill when you need to:

- Look up employee information
- Search for people by name, email, or department
- Query organizational structure and teams
- Check time-off requests and balances
- Discover available employee fields (schema discovery)

## How to Invoke

**MCP tool** (preferred — available in Slack bot and Claude Code):
```
query_hibob(method: "GET", path: "/v1/people/{id}")
```

### CLI Command
```bash
atlas data:hibob:query --method=POST --path="/v1/people/search" --body='{"filters":[]}'
atlas data:hibob:query --method=GET --path="/v1/people"
```

## Security

- Only **GET and POST** methods are allowed
- PUT, PATCH, DELETE are blocked to prevent writes
- Auth uses Basic Auth with pre-encoded service account token

## Discovering Schemas at Runtime

**Do NOT memorize HiBob field names.** Instead, discover them at runtime:

```
# List all employee fields
query_hibob(method: "GET", path: "/v1/company/people/fields")

# Get company metadata
query_hibob(method: "GET", path: "/v1/metadata/objects/company")
```

## Common Endpoints

### Search Employees
```
query_hibob(
  method: "POST",
  path: "/v1/people/search",
  body: {"showInactive": false}
)
```

### Get Specific Employee
```
query_hibob(method: "GET", path: "/v1/people/123")
```

### List Employee Fields (Schema Discovery)
```
query_hibob(method: "GET", path: "/v1/company/people/fields")
```

### Get Company Metadata
```
query_hibob(method: "GET", path: "/v1/metadata/objects/company")
```

### Get Time Off Requests
```
query_hibob(method: "GET", path: "/v1/timeoff/employees/123/requests")
```

### Get Time Off Balances
```
query_hibob(method: "GET", path: "/v1/timeoff/employees/123/balance")
```

### List Reports
```
query_hibob(method: "GET", path: "/v1/company/reports")
```

## Setup Requirements

Requires credential (resolved in order):
1. Environment variable: `ATLAS_HIBOB_TOKEN` (canonical) or `HI_BOB_TOKEN` (legacy fallback)
2. 1Password: `op://Atlas/HiBob/token`
3. Error with setup instructions

```bash
ATLAS_HIBOB_TOKEN=your_base64_encoded_token_here
```

The token is already base64-encoded in the format `SERVICE-{id}:{password}`. Used as-is in the Authorization header.

**Diagnostics:** Run `atlas credentials:status` to check credential availability and resolution.
**Sync from 1Password:** Run `atlas credentials:sync` to populate `.env` from 1Password vault.
