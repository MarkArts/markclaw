---
name: quatt-cloud-mysql-query
version: 0.5.8
description: Provides database schema context from Prisma models for writing accurate MySQL queries. Use when helping users query the Quatt Cloud database.
---

# MySQL Query via Atlas

## When to Use

Use this skill when you need to:

- Write MySQL queries for the Quatt Cloud application database
- Understand table structures and relationships
- Help users query data from development or production environments
- Investigate data issues or validate business logic

## How to Invoke

**From any repo** (installed from GitHub Packages):
```bash
npx @quattio/atlas-cli@latest data:quatt-cloud-mysql:query --env=<develop|development|staging|testing|production> --query="YOUR SQL QUERY"
```

**Locally in the atlas monorepo** (after building):
```bash
bun run atlas data:quatt-cloud-mysql:query --env=<develop|development|staging|testing|production> --query="YOUR SQL QUERY"
```

**Options:**
- `--env=<develop|development|staging|testing|production>` (required) — Target environment. `develop` and `development` are aliases for the dev environment.
- `--query="<sql>"` (required) — SQL query to execute
- `--format=<json|csv|ndjson>` — Output format (default: json)
- `--output=<path>` — Write output to file instead of stdout

## Security

- Uses **readonly MySQL users** — writes are rejected at database level
- Application also blocks non-SELECT queries as defense in depth
- Blocked keywords: INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE
- Allowed prefixes: SELECT, WITH, SHOW, DESCRIBE, DESC, EXPLAIN
- No confirmation prompts needed — readonly users make it safe

## Query Workflow (MANDATORY)

**ALWAYS follow this workflow — never skip step 2:**

1. **Identify target tables** from the Key Tables section or run `SHOW TABLES`
2. **Run `DESCRIBE <table>`** for every table you plan to query — get exact column names and types
3. **Write your query** using only column names confirmed by DESCRIBE

> **Why this matters:** Column names cannot be reliably guessed. `installationUuid` vs `installationId` vs `installation_id` — the only way to know is to check. Skipping step 2 wastes tokens on failed queries.

## Key Tables to Start With

### Core Entities
- `user` — Firebase-authenticated users
- `installation` — Physical installation locations (homes). Has `id` (int) and `externalId` (INS-xxx)
- `cic` — CIC devices (communication interface controllers). Links to installation via `installationId`
- `device` — All device types (heat pumps, thermostats, etc.)

### Relationships
- `userInstallation` — Links users to installations
- `userCic` — Links users to CICs
- `deviceCommissioning` — Links devices to commissioning sessions

### Key Relationship Patterns

**Device Linkage (IMPORTANT — check BOTH paths):**
- `device.installationUuid` → links to `installation.externalId` (INS-xxx format)
- `device.cicUuid` → links to `cic.id` (CIC-xxx format)

**CIC → Installation:**
- `cic.installationId` → `installation.id` (integer FK)

### Device-Specific Tables
- `deviceOutdoorUnit` — Heat pump outdoor units
- `deviceHeatBattery` — Heat battery configurations
- `deviceHeatCharger` — Heat charger configurations
- `deviceThermostat` — Thermostat configurations
- `deviceHomeBattery` — Home battery configurations

### Other Important Tables
- `commissioning` — Commissioning sessions
- `settingsUpdate` — Settings change history
- `tariff` — Energy tariff configurations

## Query Examples

```sql
-- Count records
SELECT COUNT(*) as total FROM user;

-- Get specific user by email
SELECT id, email, createdAt FROM user WHERE email = 'example@quatt.io';

-- Find installations by CIC ID
SELECT i.* FROM installation i
JOIN cic c ON c.installationId = i.id
WHERE c.id = 'CIC-xxx';

-- Get devices for an installation
SELECT * FROM device WHERE installationUuid = 'INS-xxx';

-- Check commissioning status
SELECT uuid, status, createdAt FROM commissioning
WHERE installationUuid = 'INS-xxx'
ORDER BY createdAt DESC LIMIT 5;
```

## ID Format Reference

- **CIC IDs**: `CIC-xxx` format (e.g., `CIC-ABC123`)
- **Installation external IDs**: `INS-xxx` format (e.g., `INS-DEF456`)
- **Installation IDs**: Integer `id` column (used in foreign keys)

## Performance Guardrails

1. **Always use LIMIT** — especially on production
2. **Use indexed columns in WHERE** — `id`, `email`, `installationId`, `cicUuid`
3. **Test queries in development first** before running on production
4. **Avoid full table scans** on large tables

## Setup Requirements

Credentials are resolved in order: environment variable, 1Password (`op read`), error.

**Environment variables** (canonical `ATLAS_` prefix, with legacy names as fallback):
```bash
# Development (full MySQL connection string)
ATLAS_MYSQL_DEV_URL="mysql://readonly:password@host:port/database"

# Production (full MySQL connection string)
ATLAS_MYSQL_PROD_URL="mysql://readonly:password@host:port/database"
```

**1Password** — If env vars are not set, credentials are fetched automatically via `op read`:
- Dev: `op://Atlas/MySQL Dev/url`
- Prod: `op://Atlas/MySQL Prod/url`

**Diagnostics** — Run `atlas credentials:status` to check which credentials are available and how they are resolved. Use `atlas credentials:sync` to sync 1Password credentials to your `.env` file.
