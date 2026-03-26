---
name: sync-hibob
description: Sync employee data from HiBob HR system to architecture/people/employees.yaml. Use when asked to update employee data, sync from HiBob, or manage the employee directory.
---

# HiBob Employee Sync Skill

## Overview

This skill syncs employee data from HiBob (the HR system) to the architecture model in `architecture/people/employees.yaml`.

**Key Constraint:** Employees are NEVER deleted - only archived via `employmentStatus: "archived"` to preserve relationship integrity.

## When to Use

Use this skill when the user wants to:

- Sync employee data from HiBob
- Update the employee directory
- See who works at Quatt
- Add new employees to the architecture
- Check employee information against HiBob

## Prerequisites

The HiBob MCP server must be configured (already in `.mcp.json`) with appropriate permissions:

- View root sections (id, email, displayName)
- View work sections (department, title, reportsTo, isManager)
- View employment sections (startDate)

## How to Execute

### Step 1: Fetch Employees from HiBob

Use the HiBob MCP tools to fetch employee data:

```
mcp__HiBob_MCP_Server__hibob_people_search
```

Call with these fields to get necessary data:

```json
{
  "fields": [
    "root.id",
    "root.displayName",
    "root.email",
    "work.department",
    "work.title",
    "work.reportsTo",
    "work.isManager",
    "work.site",
    "work.startDate"
  ]
}
```

**Note:** The `work.reportsTo` field returns a full manager object with `id`, `displayName`, and `email`. Use the manager's `id` (HiBob UUID) to link employees via the `reportsTo` field.

### Step 2: Transform and Report

After fetching the data:

1. **Report the count** of employees fetched
2. **Compare** with existing employees in `architecture/people/employees.yaml`
3. **Identify changes:**
   - New employees to add
   - Existing employees to update
   - Employees to archive (no longer in HiBob)

### Step 3: Confirm with User

Before making changes, show the user:

- Number of employees to add
- Number of employees to update
- Number of employees to archive
- List of names for each category

Ask for confirmation before proceeding.

### Step 4: Write Updates

If confirmed, write the updated employee data to `architecture/people/employees.yaml`.

The YAML format for each employee:

```yaml
- unique-id: john-doe
  entity-type: employee
  name: John Doe
  email: john.doe@quatt.io
  title: Senior Software Engineer
  department: Engineering
  isManager: false
  employmentStatus: active
  metadata:
    hibobId: "12345"
    startDate: "2023-01-15"
    lastSyncedAt: "2024-01-15T10:30:00Z"
```

### Step 5: Report Results

After syncing, report:

- Total employees in directory
- Employees added
- Employees updated
- Employees archived
- Any errors encountered

## Field Mapping

| HiBob Field | Employee Field | Notes |
|-------------|----------------|-------|
| `root.id` | `metadata.hibobId` | HiBob UUID (e.g., "3722043122914427579") |
| `root.displayName` | `name` | Full display name |
| `root.email` | `email` | Primary identifier for matching |
| `work.department` | `department` | Returns department ID, not name |
| `work.title` | `title` | Returns title ID, not name |
| `work.reportsTo.id` | `reportsTo` | Manager's HiBob UUID for lookup |
| `work.isManager` | `isManager` | Boolean |
| `work.site` | `metadata.location` | Office location (e.g., "Amsterdam Office") |
| `work.startDate` | `metadata.startDate` | Employment start date |

**Important Notes:**
- `work.department` and `work.title` return internal IDs, not human-readable names. Store as-is or maintain a lookup table.
- `work.reportsTo` returns a full object: `{id, firstName, surname, email, displayName}`. Use the `id` to find the manager's unique-id.
- Terminated employees may not appear in search results depending on HiBob API permissions.

## Manual Fields (Preserved During Sync)

These fields are NOT synced from HiBob and are preserved:

- `github` - GitHub username
- `slackMemberId` - Slack member ID
- `jiraAccountId` - Jira account ID
- `level` - Employee level (ic, lead, manager, director, executive)
- `primaryTeam` - Primary team assignment

## Alternative: CLI Script

You can also run the sync via CLI if you have a JSON file of HiBob data:

```bash
# From JSON file
bun run sync:hibob --from-file /path/to/hibob-data.json

# Dry run (preview only)
bun run sync:hibob --from-file /path/to/hibob-data.json --dry-run
```

## Example Session

User: "Sync employees from HiBob"

1. Fetch employees using `hibob_people_search` MCP tool
2. Load existing `architecture/people/employees.yaml`
3. Compare and identify changes
4. Report: "Found 45 employees in HiBob. 3 new, 5 updated, 1 to archive."
5. Ask: "Would you like me to apply these changes?"
6. If yes, write updated YAML
7. Report: "Sync complete. 45 employees in directory."

## Error Handling

- If HiBob API fails, report the error and suggest checking MCP configuration
- If YAML file is corrupted, create a backup and report the issue
- If employee has missing required fields (email), skip and report

## Output Location

- **File:** `architecture/people/employees.yaml`
- **Directory:** `architecture/people/` (created if not exists)
