---
name: Jira issue CLI Commands
description: Access Jira work item (issues/tickets) commands via the command line interface using `acli jira workitem` commands. Use when asked to work with Jira tickets.
---

# Jira Workitem CLI Commands Documentation

## Prerequisites & Installation

### Install Atlassian CLI (ACLI)

The `acli` tool is required to run Jira commands from the terminal.

**macOS Installation:**

```bash
# Add the Atlassian Homebrew tap
brew tap atlassian/acli

# Install acli
brew install acli
```

**Authentication Setup:**

After installation, configure authentication with your Atlassian credentials:

```bash
# Configure for Quatt's Jira instance
acli config add --site quatt-team
```

You'll be prompted for:
- **Jira URL**: `https://quatt-team.atlassian.net`
- **Email**: Your Atlassian account email
- **API Token**: Generate one at https://id.atlassian.com/manage-profile/security/api-tokens

**Verify Installation:**

```bash
# Check version
acli version

# Test with a simple query
acli jira workitem search --jql "project = QPD" --limit 5
```

**Official Documentation:**
- [ACLI Installation Guide](https://developer.atlassian.com/cloud/acli/guides/install-acli/)
- [macOS Installation](https://developer.atlassian.com/cloud/acli/guides/install-macos/)

---

## Instructions

Use this skill when the user asks to interact with Jira work items via the command line.

### When to Use

Use this skill when the user wants to:

- Search for Jira tickets or issues
- View details of specific work items
- Create new Jira tickets
- Update or edit existing work items (standard fields only)
- Assign work items to users
- Transition work items between statuses
- Add comments to work items
- Manage work item links

**Note:** This skill CANNOT set custom fields like story points. For custom field operations, inform the user they need to use the Jira web UI or alternative tools.

### How to Use

1. **Determine the user's intent** - Identify what Jira operation they want to perform
2. **Choose the appropriate command** - Select from the commands listed below
3. **Construct the command** - Use proper flags and arguments
4. **Execute via Bash tool** - Run the command and return results to user
5. **Parse and present results** - Format the output in a user-friendly way with proper URLs

### URL Formatting

**IMPORTANT:** When presenting Jira ticket URLs to the user, always use the Atlassian browse URL format:

```
https://quatt-team.atlassian.net/browse/{TICKET_KEY}
```

**How to extract the ticket key:**

- From JSON responses: Use the `key` field (e.g., `QPD-10861`)
- From create/edit operations: Parse from the JSON response's `key` field
- From search results: Each result has a `key` field

**Example:**

```javascript
// JSON response from create command
{
  "key": "QPD-10861",
  "self": "https://jira-prod-eu-54-1.prod.atl-paas.net/rest/api/3/issue/48598"
}

// Present to user as:
"Created ticket QPD-10861: https://quatt-team.atlassian.net/browse/QPD-10861"
```

**Never use** the `self` URL from JSON responses - it's an internal API URL, not a user-friendly browse URL.

---

## Available Commands

### Core Commands (Fully Documented Below)

| Command        | Description             | Common Flags                                                                |
| -------------- | ----------------------- | --------------------------------------------------------------------------- |
| **create**     | Create new Jira tickets | `--project`, `--type`, `--summary`, `--description`, `--assignee`, `--json` |
| **edit**       | Edit existing tickets   | `--key`, `--summary`, `--description`, `--assignee`, `--yes`, `--json`      |
| **search**     | Find tickets using JQL  | `--jql`, `--filter`, `--json`, `--fields`, `--limit`, `--paginate`          |
| **view**       | View ticket details     | `key`, `--json`, `--fields`, `--web`                                        |
| **comment**    | Add/list comments       | `--key`, `--body`, `--json`                                                 |
| **transition** | Change ticket status    | `--key`, `--status`, `--yes`, `--json`                                      |
| **assign**     | Assign tickets to users | `--key`, `--assignee`, `--yes`                                              |

### Additional Commands (Use `--help` for details)

- **link** - Create/manage links between tickets (`acli jira workitem link --help`)
- **clone** - Duplicate tickets (`acli jira workitem clone --help`)
- **archive/unarchive** - Archive/restore tickets (`acli jira workitem archive --help`)
- **delete** - Delete tickets permanently (`acli jira workitem delete --help`)
- **attachment** - Manage attachments (`acli jira workitem attachment --help`)

### Common Patterns

**Selecting Work Items:**

```bash
# By specific keys
--key "QPD-123,QPD-456"

# By JQL query (most flexible)
--jql "project = QPD AND status = 'In Progress'"

# By saved filter
--filter 10001

# From file
--from-file "issues.txt"
```

**Common Flags:**

- `--json` - Machine-readable JSON output
- `--yes` or `-y` - Skip confirmation prompts
- `--ignore-errors` - Continue on errors when processing multiple items

---

## Core Command Reference

### create - Create a Jira Work Item

Create a new Jira ticket to track work.

**Usage:**

```bash
acli jira workitem create [flags]
```

**Key Flags:**

- `-p, --project string` - Project key (e.g., "QPD")
- `-t, --type string` - Issue type: "Epic", "Story", "Task", "Bug"
- `-s, --summary string` - Ticket summary/title
- `-d, --description string` - Description in plain text or ADF
- `-a, --assignee string` - Email, account ID, or `@me` for self-assign
- `-l, --label strings` - Comma-separated labels
- `--parent string` - Parent work item ID (e.g., "QPD-152" for epic parent)
- `--json` - Output in JSON format

**Examples:**

```bash
# Create a task
acli jira workitem create \
  --project "QPD" \
  --type "Task" \
  --summary "Fix authentication bug" \
  --description "Users cannot login after password reset" \
  --assignee "@me" \
  --json

# Create a bug with labels
acli jira workitem create \
  --project "QPD" \
  --type "Bug" \
  --summary "API returns 500 on invalid input" \
  --label "backend,api,critical" \
  --json

# Create a task with parent epic
acli jira workitem create \
  --project "QPD" \
  --type "Task" \
  --summary "Fix production issue" \
  --parent "QPD-152" \
  --json
```

---

### edit - Edit a Jira Work Item

Modify existing ticket fields.

**Usage:**

```bash
acli jira workitem edit [flags]
```

**Key Flags:**

- `-k, --key string` - Ticket key(s) to edit
- `-s, --summary string` - New summary
- `-d, --description string` - New description
- `-a, --assignee string` - New assignee (email, account ID, or `@me`)
- `-l, --labels string` - Set labels
- `--remove-assignee` - Remove assignee
- `--jql string` - Edit multiple tickets via JQL
- `-y, --yes` - Skip confirmation
- `--json` - Output in JSON

**Examples:**

```bash
# Edit ticket summary
acli jira workitem edit \
  --key "QPD-10861" \
  --summary "Optimize consumer endpoint payload" \
  --yes

# Bulk edit tickets via JQL
acli jira workitem edit \
  --jql "project = QPD AND status = 'To Do' AND assignee is EMPTY" \
  --assignee "@me" \
  --yes
```

---

### search - Search for Work Items

Find tickets using JQL queries or filters.

**Usage:**

```bash
acli jira workitem search [flags]
```

**Key Flags:**

- `-j, --jql string` - JQL query
- `--filter string` - Saved filter ID
- `-f, --fields string` - Fields to display (default: "issuetype,key,assignee,priority,status,summary")
- `-l, --limit int` - Maximum number of tickets to fetch
- `--paginate` - Fetch all tickets across multiple pages
- `--json` - Output in JSON format
- `--csv` - Output in CSV format
- `--count` - Return only count

**Examples:**

```bash
# Search for open tickets assigned to me
acli jira workitem search \
  --jql "assignee = currentUser() AND status != Done" \
  --json

# Search with specific fields
acli jira workitem search \
  --jql "project = QPD AND created >= -7d" \
  --fields "key,summary,created,assignee" \
  --json

# Count tickets
acli jira workitem search \
  --jql "project = QPD AND status = 'In Progress'" \
  --count
```

---

### view - View Ticket Details

Retrieve detailed information about specific tickets.

**Usage:**

```bash
acli jira workitem view [key] [flags]
```

**Key Flags:**

- `-f, --fields string` - Fields to return (default: "key,issuetype,summary,status,assignee,description")
  - `*all` - All fields
  - `*navigable` - Navigable fields
  - Comma-separated list: `summary,comment,status`
- `--json` - Output in JSON format
- `-w, --web` - Open ticket in web browser

**Examples:**

```bash
# View ticket details
acli jira workitem view QPD-10861 --json

# View specific fields
acli jira workitem view QPD-10861 --fields "summary,description,status,comments" --json

# Open in browser
acli jira workitem view QPD-10861 --web
```

---

### comment - Work with Comments

Add or list comments on tickets.

**Create Comment Usage:**

```bash
acli jira workitem comment create [flags]
```

**Key Flags:**

- `-k, --key string` - Ticket key(s) to comment on
- `-b, --body string` - Comment body (plain text or ADF)
- `-F, --body-file string` - Read comment from file
- `--jql string` - Comment on multiple tickets via JQL
- `--json` - Output in JSON format

**List Comments Usage:**

```bash
acli jira workitem comment list [flags]
```

**Examples:**

```bash
# Add comment to ticket
acli jira workitem comment create \
  --key "QPD-10861" \
  --body "Started implementation. mapMeCIC refactor in progress."

# List comments
acli jira workitem comment list --key "QPD-10861" --json
```

---

### transition - Change Ticket Status

Move tickets between workflow statuses.

**Usage:**

```bash
acli jira workitem transition [flags]
```

**Key Flags:**

- `-k, --key string` - Ticket key(s) to transition
- `-s, --status string` - Target status (e.g., "To Do", "In Progress", "Done")
- `--jql string` - Transition multiple tickets via JQL
- `-y, --yes` - Skip confirmation
- `--json` - Output in JSON

**Examples:**

```bash
# Move ticket to In Progress
acli jira workitem transition \
  --key "QPD-10861" \
  --status "In Progress" \
  --yes

# Bulk transition tickets
acli jira workitem transition \
  --jql "project = QPD AND status = 'Code Review' AND reviewer = currentUser()" \
  --status "Done" \
  --yes
```

---

### assign - Assign Tickets to Users

Assign or reassign tickets to team members.

**Usage:**

```bash
acli jira workitem assign [flags]
```

**Key Flags:**

- `-k, --key string` - Ticket key(s) to assign
- `-a, --assignee string` - Email, account ID, `@me` (self), or `default` (project default)
- `--remove-assignee` - Remove assignee
- `--jql string` - Assign multiple tickets via JQL
- `-y, --yes` - Skip confirmation

**Examples:**

```bash
# Self-assign ticket
acli jira workitem assign --key "QPD-10861" --assignee "@me" --yes

# Bulk assign
acli jira workitem assign \
  --jql "project = QPD AND status = 'Backlog' AND assignee is EMPTY" \
  --assignee "@me" \
  --yes
```

---

## Limitations

### Parent Field Cannot Be Modified After Creation

**LIMITATION** - The `--parent` flag is ONLY available in the `create` command, NOT in the `edit` command.

- Once a ticket is created, you cannot change its parent via acli
- If you forget to set `--parent` during creation, you must set it manually in Jira UI
- The `edit` command does not support the `--parent` flag

**Best Practice:**

- Always specify `--parent` flag when creating tickets that belong to an epic
- Example: `--parent "QPD-152"` to set the maintenance epic as parent

**Workaround if Parent Not Set:**

- Use the Jira web UI to manually set the parent field

### Custom Fields (Story Points, etc.)

**NOT SUPPORTED** - `acli jira workitem` commands do NOT support setting custom fields like story points (`customfield_10016`).

- The `--generate-json` template only includes standard fields
- Custom fields like `customfield_XXXXX` cannot be set via command-line flags
- The `edit` and `create` commands only support standard Jira fields

**Workarounds:**

- Use the Jira web UI for custom fields
- Use the Jira REST API directly
- Use alternative CLI tools (e.g., `jira-cli` by ankitpokhrel)

---

## Quick Reference

### Common JQL Patterns

```bash
# My open tickets
--jql "assignee = currentUser() AND status != Done"

# Tickets created in last 7 days
--jql "project = QPD AND created >= -7d"

# Unassigned bugs in progress
--jql "project = QPD AND issuetype = Bug AND status = 'In Progress' AND assignee is EMPTY"

# Tickets without story points
--jql "project = QPD AND 'Story Points' is EMPTY"
```

### Common Workflows

```bash
# Create ticket and assign to self
acli jira workitem create --project "QPD" --type "Task" --summary "..." --assignee "@me" --json

# Search, then transition to Done
acli jira workitem search --jql "..." --json  # Get keys
acli jira workitem transition --key "QPD-123,QPD-456" --status "Done" --yes

# Bulk assign unassigned tickets
acli jira workitem assign --jql "project = QPD AND assignee is EMPTY" --assignee "@me" --yes
```

---

## Help Commands

For any command, use `--help` to see full documentation:

```bash
acli jira workitem --help
acli jira workitem create --help
acli jira workitem search --help
```
