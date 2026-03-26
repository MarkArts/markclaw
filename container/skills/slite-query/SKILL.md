---
name: slite-query
version: 0.5.8
description: Query Quatt's Slite knowledge base (notes, channels, AI-powered Q&A). Use when helping users find documentation, search notes, or ask questions about internal knowledge.
---

# Slite Query via Atlas

## When to Use

Use this skill when you need to:

- Search for documentation in Slite
- Read specific notes or documents
- Navigate the document hierarchy (channels, child notes)
- Ask questions against the knowledge base (AI-powered /ask endpoint)
- List available channels

## How to Invoke

**MCP tool** (preferred — available in Slack bot and Claude Code):
```
query_slite(method: "GET", path: "/v1/notes?search=query")
```

### CLI Command
```bash
atlas data:slite:query --method=GET --path="/v1/notes?search=onboarding"
atlas data:slite:query --method=POST --path="/v1/ask" --body='{"question":"What is the onboarding process?"}'
```

## Security

- Only **GET and POST** methods are allowed
- PUT, PATCH, DELETE are blocked to prevent writes
- Auth uses custom `x-slite-api-key` header

## Common Endpoints

### Search Notes
```
query_slite(method: "GET", path: "/v1/notes?search=onboarding")
```

### Get a Specific Note
```
query_slite(method: "GET", path: "/v1/notes/note-id-here")
```

### Get Note Children
```
query_slite(method: "GET", path: "/v1/notes/note-id-here/children")
```

### Ask a Question (AI-Powered)
```
query_slite(
  method: "POST",
  path: "/v1/ask",
  body: {"question": "How does the refund process work?"}
)
```

### List Channels
```
query_slite(method: "GET", path: "/v1/channels")
```

### List Recently Visited Notes
```
query_slite(method: "GET", path: "/v1/notes/recently-visited")
```

### List Recently Edited Notes
```
query_slite(method: "GET", path: "/v1/notes/recently-edited")
```

## Key Slite Doc IDs (from architecture context)

| Doc | ID | Topic |
|-----|----|-------|
| Deal Stages Overview | XOhSRqB_YhGPRq | HubSpot pipeline stages |
| HubSpot Deal Stages | YwQLZx2Zi-Rk_w | Detailed stage definitions |
| CS Knowledgebase | x1sV6x7crxcJAZ | Customer Support reference |
| Sales Forwarding | yuSoNB3wL5A1QT | CS → Sales routing process |
| Refund Process | ra5-kFZeKlMxTY | Finance lost deal stages |
| Subsidieproces | 9CH6blIkjOfU_W | ISDE subsidy applications |
| Quatt Care | 1eT0QtmH7u57uR | Subscription management |
| Chill Stages | MsK8nvqrbIQGZ3 | Chill pipeline stages |
| All-Electric Stages | s7Nf-Q5_PHVVxM | AE pipeline stages |

## Setup Requirements

Requires credential (resolved in order):
1. Environment variable: `ATLAS_SLITE_KEY` (canonical) or `SLITE_API_KEY` (legacy fallback)
2. 1Password: `op://Atlas/Slite/key`
3. Error with setup instructions

```bash
ATLAS_SLITE_KEY=your_slite_api_key_here
```

**Diagnostics:** Run `atlas credentials:status` to check credential availability and resolution.
**Sync from 1Password:** Run `atlas credentials:sync` to populate `.env` from 1Password vault.
