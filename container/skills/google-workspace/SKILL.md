---
name: google-workspace
description: Access Gmail, Google Calendar, and Google Drive. Read/send emails, manage calendar events, search and download files. Use whenever the user asks about email, meetings, schedule, or documents.
allowed-tools: Bash(gwcli:*)
---

# Google Workspace CLI (gwcli)

Pre-authenticated. Profile: `mark`. Use `-f json` for structured output.

## Gmail

```bash
gwcli gmail list                          # Recent inbox
gwcli gmail list --max 20                 # More results
gwcli gmail search "from:boss subject:urgent"
gwcli gmail read <message-id>             # Full email
gwcli gmail thread <thread-id>            # Full thread
gwcli gmail send --to "a@b.com" --subject "Hi" --body "Hello"
gwcli gmail reply <message-id> --body "Thanks"
gwcli gmail draft --to "a@b.com" --subject "Draft" --body "..."
gwcli gmail send <draft-id>               # Send existing draft
gwcli gmail archive <message-id>
gwcli gmail trash <message-id>
```

## Calendar

```bash
gwcli calendar events                     # Upcoming events
gwcli calendar events --days 7            # Next 7 days
gwcli calendar list                       # All calendars
gwcli calendar search "standup"           # Search events
gwcli calendar create "Meeting" --start "2024-01-15T10:00" --end "2024-01-15T11:00"
gwcli calendar create "Lunch" --start "2024-01-15T12:00" --duration 60
gwcli calendar update <event-id> --title "New title"
gwcli calendar delete <event-id>
```

## Drive

```bash
gwcli drive list                          # Root files
gwcli drive list --folder <folder-id>     # Folder contents
gwcli drive search "quarterly report"     # Search files
gwcli drive download <file-id>            # Download file
gwcli drive export <file-id> --format pdf # Export Google Doc/Sheet
```
