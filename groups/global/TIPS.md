# Learnings

## Guidelines
This file should be short and concise — only instructions that apply to everything. Project-specific details belong in the project itself.

## Tool Installation
- You run in a sandbox — install whatever you need. Don't ask permission.

## Jira CLI (acli)
- Allowed search fields: `issuetype,key,assignee,priority,status,summary` (NOT `parent` or `project`)
- **Epic/parent:** `--parent` only works on `create`, NOT `edit`. Always set `--parent "KEY-XXX"` at creation time.
- Descriptions: use **ADF JSON** via `--description-file` for rich formatting

## Verification
- Always test locally (`pulumi preview` for IaC) before pushing
- After deploying, verify it worked in the target system
