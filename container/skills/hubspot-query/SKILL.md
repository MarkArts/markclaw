---
name: hubspot-query
version: 0.5.8
description: Query Quatt's HubSpot CRM data (contacts, deals, companies, custom objects). Use when helping users look up customer data, deals, or house records in HubSpot.
---

# HubSpot Query via Atlas

## When to Use

Use this skill when you need to:

- Look up customer data in HubSpot (contacts, deals, companies)
- Search for houses (custom object) by address, installation ID, or other properties
- Query deal pipelines and stages
- Investigate CRM data for customer support or analysis
- Discover available HubSpot properties for any object type

## How to Invoke

**From any repo** (installed from GitHub Packages):
```bash
npx @quattio/atlas-cli@latest data:hubspot:query --method=<GET|POST> --path="/crm/v3/..." [--body='{"..."}']
```

**Locally in the atlas monorepo** (after building):
```bash
bun run atlas data:hubspot:query --method=<GET|POST> --path="/crm/v3/..." [--body='{"..."}']
```

**Options:**
- `--method=<GET|POST>` (required) — HTTP method (only GET and POST allowed)
- `--path="<api-path>"` (required) — HubSpot API endpoint path
- `--body='<json>'` — Request body for POST requests (JSON string)
- `--format=<json|csv|ndjson>` — Output format (default: json)
- `--output=<path>` — Write output to file instead of stdout

## Security

- Only **GET and POST** methods are allowed
- POST is needed because HubSpot search endpoints use POST
- PUT, PATCH, DELETE are blocked to prevent writes
- The API token's permissions are the second safety layer

## Discovering Schemas at Runtime

**Do NOT memorize HubSpot properties.** Instead, discover them at runtime:

```bash
# List all properties for contacts
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/properties/contacts"

# List all properties for deals
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/properties/deals"

# List all properties for companies
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/properties/companies"

# List properties for custom object (houses)
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/properties/2-34498498"
```

## Object Types Used by Quatt

| Object Type | API Name | Description |
|-------------|----------|-------------|
| Contacts | `contacts` | Customer contact records |
| Companies | `companies` | Company records |
| Deals | `deals` | Sales deals and opportunities |
| Houses | `2-34498498` | Custom object for house/installation records |

## Common Endpoints

### Get Object Properties (schema discovery)
```bash
# GET /crm/v3/properties/{objectType}
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/properties/contacts"
```

### Get Single Record
```bash
# GET /crm/v3/objects/{objectType}/{id}
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/objects/contacts/123"

# With specific properties
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/objects/contacts/123?properties=email,firstname,lastname"
```

### Search Records
```bash
# POST /crm/v3/objects/{objectType}/search
npx @quattio/atlas-cli@latest data:hubspot:query --method=POST --path="/crm/v3/objects/contacts/search" \
  --body='{"filterGroups":[{"filters":[{"propertyName":"email","operator":"EQ","value":"user@example.com"}]}],"properties":["email","firstname","lastname"]}'
```

### List Records
```bash
# GET /crm/v3/objects/{objectType}
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/objects/deals?limit=10&properties=dealname,amount,dealstage"
```

## Search Filter Syntax

HubSpot search uses POST with filter groups:

```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "email",
          "operator": "EQ",
          "value": "user@example.com"
        }
      ]
    }
  ],
  "properties": ["email", "firstname", "lastname"],
  "limit": 10,
  "after": 0
}
```

### Available Operators
- `EQ` — Equals
- `NEQ` — Not equals
- `LT`, `LTE`, `GT`, `GTE` — Comparisons
- `CONTAINS_TOKEN` — Contains word
- `NOT_CONTAINS_TOKEN` — Does not contain word
- `HAS_PROPERTY` — Property exists
- `NOT_HAS_PROPERTY` — Property does not exist
- `IN` — In list of values

## Common Workflows

### Find a contact by email
```bash
npx @quattio/atlas-cli@latest data:hubspot:query --method=POST --path="/crm/v3/objects/contacts/search" \
  --body='{"filterGroups":[{"filters":[{"propertyName":"email","operator":"EQ","value":"customer@example.com"}]}],"properties":["email","firstname","lastname","phone"]}'
```

### Find deals for a contact
```bash
# First get contact ID, then get associated deals
npx @quattio/atlas-cli@latest data:hubspot:query --method=GET --path="/crm/v3/objects/contacts/123/associations/deals"
```

### Look up a house by installation ID
```bash
npx @quattio/atlas-cli@latest data:hubspot:query --method=POST --path="/crm/v3/objects/2-34498498/search" \
  --body='{"filterGroups":[{"filters":[{"propertyName":"installation_id","operator":"EQ","value":"INS-xxx"}]}]}'
```

## Setup Requirements

Requires credential (resolved in order):
1. Environment variable: `ATLAS_HUBSPOT_TOKEN` (canonical) or `HUBSPOT_API_TOKEN` / `HUBSPOT_PRODUCTION_READONLY_TOKEN` (legacy fallbacks)
2. 1Password: `op://Atlas/HubSpot/token`
3. Error with setup instructions

```bash
ATLAS_HUBSPOT_TOKEN="pat-xxx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Diagnostics:** Run `atlas credentials:status` to check credential availability and resolution.
**Sync from 1Password:** Run `atlas credentials:sync` to populate `.env` from 1Password vault.
