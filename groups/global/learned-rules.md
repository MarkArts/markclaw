# Learned Rules

Rules added from user corrections. All agents must follow these.

## General

- Always include a link when referencing an external item: Jira tickets, Sentry issues, Axiom log lines, GitHub PRs, code files (link to the relevant GitHub file), etc. Never mention these by name/ID alone without a URL.

## Slack output

- Slack messages render in mrkdwn, NOT markdown. `#`/`##` headings render as literal `#`, `**bold**` renders literally, tables don't render, `---` rules don't render. Use `*bold*`, `_italic_`, `>` for quotes, `•` or `-` for bullets, blank lines for section breaks. No headings — use `*Section:*` inline or a blank line.
- Be concise. No verbose multi-section reports unless explicitly asked. Lead with the answer, cut preamble, trim filler.
