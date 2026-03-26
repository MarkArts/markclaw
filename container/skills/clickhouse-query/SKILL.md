---
name: clickhouse-query
version: 0.5.8
description: Provides ClickHouse schema context for writing accurate time-series analytics queries. Use when helping users query ClickHouse tables for device stats, insights, and analytics data.
---

# ClickHouse Query via Atlas

## When to Use

Use this skill when you need to:

- Write ClickHouse queries for time-series analytics data
- Query device statistics (CIC stats, all-electric stats, CHILL stats)
- Investigate device behavior or performance over time
- Generate insights or analyze energy consumption data
- Help users query data from development or production ClickHouse environments

## How to Invoke

**From any repo** (installed from GitHub Packages):
```bash
npx @quattio/atlas-cli@latest data:clickhouse:query --env=<develop|development|staging|testing|production> --query="YOUR SQL QUERY"
```

**Locally in the atlas monorepo** (after building):
```bash
bun run atlas data:clickhouse:query --env=<develop|development|staging|testing|production> --query="YOUR SQL QUERY"
```

**Options:**
- `--env=<develop|development|staging|testing|production>` (required) — Target environment. `develop` and `development` are aliases for the dev environment.
- `--query="<sql>"` (required) — SQL query to execute
- `--timeout=<ms>` — Query timeout in milliseconds (default: 60000)
- `--format=<json|csv|ndjson>` — Output format (default: json)
- `--output=<path>` — Write output to file instead of stdout

## Security

- Uses **readonly ClickHouse users** — writes are rejected at database level
- Application also blocks non-SELECT queries as defense in depth
- Blocked keywords: INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE
- Allowed prefixes: SELECT, WITH, SHOW, DESCRIBE, DESC, EXPLAIN
- No confirmation prompts needed — readonly users make it safe

## Key Tables to Start With

> **You can query ANY table in ClickHouse**, not just those listed below. Run `SHOW TABLES` to see the full list. The database includes MySQL engine tables (`mysql_*`), materialized views, and other tables not listed here. The tables below are common starting points.

- `cic_stats` — Main statistics for CIC devices (hybrid heating systems)
- `all_e_stats` — All-electric system statistics (heat battery + heat charger)
- `chill_stats` — CHILL product (cooling) statistics
- `thread_device_stats` — Thread-enabled device statistics
- `cic_stats_by_time` — Time-partitioned CIC stats (faster for recent data)
- `all_e_stats_by_time` — Time-partitioned all-e stats (faster for recent data)
- `cic_connection_status` — Device connectivity tracking
- `installation_energy_consumption` — Aggregated energy consumption
- `mysql_cic_state` — MySQL engine table mirroring CIC device state from Quatt Cloud DB
- `installation_counters_interpolated` — Interpolated installation counter data for insights pipeline debugging

## Common Column Patterns

- **Device identifier**: `clientid` (String, format: 'CIC-xxx')
- **Time column**: `time_ts` (DateTime)
- **Installation link**: `installationid` (Nullable UInt32)
- **Heat pump columns**: `hp1_*`, `hp2_*` prefixed
- **All-electric columns**: `hb_*` (heat battery), `hc_*` (heat charger), `system_*`
- **CHILL columns**: `qcChill_*` prefixed

## Query Workflow (MANDATORY)

**ALWAYS follow this workflow — never skip step 2:**

1. **`SHOW TABLES`** — Discover available tables
2. **`DESCRIBE <table>`** — Get exact column names and types before writing any query
3. **`SHOW CREATE TABLE <table>`** — Check the primary key / `ORDER BY` clause to understand how data is indexed
4. **Write your query** using the correct column names and filtering by the primary key columns

> **Why this matters:** Column names cannot be reliably guessed. `clientid` vs `cic_id`, `time_ts` vs `timestamp` — the only way to know is to check. Skipping step 2 wastes tokens on failed queries.

**⚠️ Primary keys vary across tables.** Do NOT assume `clientid` is always the primary key. Different tables use different identifiers:

- `cic_stats` / `all_e_stats` — `clientid` (String, e.g., `'CIC-xxx'`)
- `installation_energy_consumption` — `installationId`
- `cic_connection_status` — `cicId`
- Other tables may use different keys entirely

Always check `SHOW CREATE TABLE` to confirm the primary key before writing WHERE clauses. Filtering on non-primary-key columns causes full table scans on large tables.

## Query Examples

```sql
-- Get recent stats for a specific CIC
SELECT clientid, time_ts, hp1_temperatureOutside, hp1_compressorFrequency
FROM cic_stats
WHERE clientid = 'CIC-xxx'
ORDER BY time_ts DESC
LIMIT 10;

-- Time-series analysis with hourly aggregation
SELECT
  toStartOfHour(time_ts) as hour,
  avg(hp1_compressorFrequency) as avg_freq,
  avg(hp1_temperatureOutside) as avg_outdoor_temp
FROM cic_stats
WHERE clientid = 'CIC-xxx'
  AND time_ts >= now() - INTERVAL 7 DAY
GROUP BY hour
ORDER BY hour DESC;

-- Latest stat per device (last 24h)
SELECT clientid, max(time_ts) as last_seen
FROM cic_stats
WHERE time_ts >= now() - INTERVAL 1 DAY
GROUP BY clientid
ORDER BY last_seen DESC
LIMIT 20;

-- Count records
SELECT COUNT(*) as total FROM cic_stats;
```

## ClickHouse-Specific Tips

- **Time functions**: `toStartOfHour()`, `toStartOfDay()`, `toStartOfMinute()`
- **Latest value per group**: `argMax(column, time_ts)` — gets value at max time
- **Percentiles**: `quantile(0.95)(column)` — p95 of a metric
- **Date arithmetic**: `now() - INTERVAL 7 DAY`, `today() - 30`
- **Time-partitioned tables**: Use `*_by_time` variants for better performance on recent data

## Performance Guardrails

1. **Always use LIMIT** on production queries (recommend <= 1000)
2. **Always filter by `clientid` or narrow time range** on production
3. **Prefer aggregations** over full row selects
4. **Use time-partitioned tables** (`*_by_time`) for recent data
5. **Test queries in development first** before running on production

## Data Reporting Intervals

- CIC devices report stats every **15 seconds** during normal operation
- For "latest" queries, use 20-30 second windows
- Missing data beyond 1 minute may indicate connectivity issues

## Setup Requirements

Credentials are resolved in order: environment variable, 1Password (`op read`), error.

**Environment variables** (canonical `ATLAS_` prefix, with legacy names as fallback):
```bash
# Development (readonly)
ATLAS_CLICKHOUSE_DEV_HOST="https://..."
ATLAS_CLICKHOUSE_DEV_USER="readonly"
ATLAS_CLICKHOUSE_DEV_PASSWORD="..."

# Production (readonly)
ATLAS_CLICKHOUSE_PROD_HOST="https://..."
ATLAS_CLICKHOUSE_PROD_USER="readonly"
ATLAS_CLICKHOUSE_PROD_PASSWORD="..."
```

**1Password** — If env vars are not set, credentials are fetched automatically via `op read`:
- Dev: `op://Atlas/ClickHouse Dev/host`, `op://Atlas/ClickHouse Dev/username`, `op://Atlas/ClickHouse Dev/password`
- Prod: `op://Atlas/ClickHouse Prod/host`, `op://Atlas/ClickHouse Prod/username`, `op://Atlas/ClickHouse Prod/password`

**Diagnostics** — Run `atlas credentials:status` to check which credentials are available and how they are resolved. Use `atlas credentials:sync` to sync 1Password credentials to your `.env` file.
