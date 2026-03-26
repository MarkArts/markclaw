---
name: redis-query
version: 0.5.8
description: Query Redis instances for CIC cached state, BullMQ queues, and key inspection. Use when investigating device state, worker queues, or cached data.
---

# Redis Query via Atlas

## When to Use

Use this skill when you need to:
- Check if a CIC is online (check cached lastStat)
- Inspect cached device state in Redis
- Investigate BullMQ job queues
- Debug worker processing issues
- Read/write specific Redis keys for testing

## How to Invoke

**Locally:**
```bash
bun run atlas data:redis:query --env=<develop|production> --command="<redis-command>"
```

**From any repo:**
```bash
npx @quattio/atlas-cli@latest data:redis:query --env=<develop|production> --command="<redis-command>"
```

**Options:**
- `--env=<develop|production>` (required) — Target environment
- `--command="<command>"` (required) — Full Redis command string
- `--allow-writes` — Enable write commands (SET, HSET, SETEX, JSONSET)
- `--format=<json|raw>` — Output format (default: json)
- `--output=<path>` — Write output to file

## Key Patterns

### CIC State Keys
- `cic:<CIC-ID>:lastStat` — Last telemetry stats (JSON blob with all cloudConnectorObjects)
- `cic:<CIC-ID>:config` — CIC configuration
- `cic:<CIC-ID>:desiredConfig` — Pending configuration updates

### BullMQ Queues
- `bull:*` — BullMQ queue keys
- Use `KEYS bull:*` to discover queue names

### Common Workflows

**Check if a CIC is online (has recent data):**
```bash
bun run atlas data:redis:query --env=develop --command="TTL cic:CIC-ABC123:lastStat"
```

**Get CIC's cached state:**
```bash
bun run atlas data:redis:query --env=develop --command="GET cic:CIC-ABC123:lastStat"
```

**List all CIC stat keys:**
```bash
bun run atlas data:redis:query --env=develop --command="KEYS cic:*:lastStat"
```

**Get hash fields:**
```bash
bun run atlas data:redis:query --env=develop --command="HGETALL cic:CIC-ABC123:lastStat"
```

**Check key type:**
```bash
bun run atlas data:redis:query --env=develop --command="TYPE cic:CIC-ABC123:lastStat"
```

**Server info:**
```bash
bun run atlas data:redis:query --env=develop --command="INFO server"
```

## Write Operations

Write commands require `--allow-writes`:

```bash
# Set a value
bun run atlas data:redis:query --env=develop --allow-writes --command="SET test-key test-value"

# Set with expiry
bun run atlas data:redis:query --env=develop --allow-writes --command="SETEX test-key 3600 test-value"

# JSON path update (read-modify-write with TTL preservation)
bun run atlas data:redis:query --env=develop --allow-writes --command='JSONSET cic:CIC-xxx:lastStat qcChill.setpoint.isWorking true'
```

## Security

- **Read commands** (GET, HGET, HGETALL, KEYS, TTL, TYPE, INFO, etc.) — always allowed
- **Write commands** (SET, HSET, SETEX, JSONSET) — only with `--allow-writes`
- **Destructive commands** (DEL, FLUSHDB, FLUSHALL, SHUTDOWN, CONFIG) — always blocked

**Warning:** `KEYS` can be slow on large databases. Use `SCAN` for production workloads.

## Setup

Set the following environment variables in `.env` or `~/.config/atlas/.env`:

```bash
# Development
ATLAS_REDIS_DEV_URL=rediss://user:pass@host:port

# Production
ATLAS_REDIS_PROD_URL=rediss://user:pass@host:port
```

Or use 1Password: `atlas credentials:status` to check, `atlas credentials:sync` to provision.
