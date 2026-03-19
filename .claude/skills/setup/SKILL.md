---
name: setup
description: First-time MarkClaw setup. Guides user through dependencies, Slack app creation, credentials, SSH keys, container build, and service configuration.
---

# MarkClaw First-Time Setup

Interactive setup that walks the user through getting MarkClaw running. Ask questions conversationally, do the work, only pause when user action is genuinely required (pasting tokens, approving in browser).

**Principle:** Fix things yourself. Don't tell the user to go run commands — run them. Only ask the user to do things that require their browser or their credentials.

## 1. Prerequisites Check

Check what's already in place:

```bash
node --version          # Need 22+
docker --version        # Need Docker
docker info >/dev/null 2>&1  # Need Docker running
ls .env 2>/dev/null     # Existing config?
ls .ssh/id_ed25519 2>/dev/null  # SSH key?
```

If Node.js is missing or too old, install via nvm:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22
```

If Docker is not installed or not running, tell the user to install Docker and start it before continuing.

## 2. Install Dependencies

```bash
npm install
```

## 3. Create Slack App

Tell the user:

> Go to https://api.slack.com/apps and click **Create New App** → **From a manifest**.
> Select your workspace, switch to **JSON** tab, then paste the contents of `slack-app-manifest.json` from this repo.

> After creating:
> 1. Click **Install to Workspace** and approve
> 2. Copy the **Bot User OAuth Token** (starts with `xoxb-`) from **OAuth & Permissions**
> 3. Go to **Basic Information** → **App-Level Tokens** → **Generate Token** with scope `connections:write` → copy it (starts with `xapp-`)

Use AskUserQuestion to collect:
- The `xoxb-` bot token
- The `xapp-` app-level token

## 4. Find User ID

Tell the user:

> In Slack, click your profile picture → **Profile** → click the **three dots (⋯)** → **Copy member ID**

Use AskUserQuestion to collect their Slack user ID (starts with `U`).

## 5. Claude Authentication

Use AskUserQuestion: **Do you have an Anthropic API key, or are you using a Claude subscription (Pro/Max)?**

**API key:** Ask them to paste it. Write to `.env` as `ANTHROPIC_API_KEY=<key>`.

**Subscription (OAuth):** Tell them to run `claude /login` in a separate terminal, then run `claude setup-token` and paste the resulting token. Write to `.env` as `CLAUDE_CODE_OAUTH_TOKEN=<token>`.

## 6. Write .env

Create the `.env` file with all collected values:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_ALLOWED_USERS=U...
ANTHROPIC_API_KEY=sk-ant-...   # or CLAUDE_CODE_OAUTH_TOKEN
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Detect the system timezone and suggest it as the default:
```bash
timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo "UTC"
```
Ask the user to confirm or provide their timezone (e.g. `Europe/Amsterdam`, `America/New_York`). Write it to `.env` as `TZ=<timezone>`.

Also ask if they want to set `GITHUB_ORG` and `JIRA_SITE` for the web UI dashboard (optional).

## 7. Generate SSH Keys

Check if `.ssh/id_ed25519` already exists. If not:

```bash
mkdir -p .ssh
ssh-keygen -t ed25519 -N "" -f .ssh/id_ed25519 -C "markclaw-agent"
ssh-keyscan github.com >> .ssh/known_hosts 2>/dev/null
chmod 700 .ssh && chmod 600 .ssh/*
```

Show the public key and tell the user:

> Add this public key to your GitHub account at https://github.com/settings/ssh/new
> (or as a deploy key on specific repos if you prefer)

## 8. Build

```bash
npm run build
docker build -t markclaw-agent container/
```

If the container build fails, check Docker is running and retry.

## 9. Create Tool Credentials (optional)

Ask if they want to set up tool credentials for their agents. If yes, create `groups/global/.env-shared`:

```bash
mkdir -p groups/global
touch groups/global/.env-shared
```

Explain the format and ask which tools they use:
- `GH_TOKEN` — GitHub personal access token
- `SENTRY_AUTH_TOKEN` — Sentry
- `JIRA_API_TOKEN` + `JIRA_SITE` + `JIRA_USER` — Jira
- `HEROKU_API_KEY` — Heroku
- `AXIOM_TOKEN` + `AXIOM_ORG_ID` — Axiom

Write each as `export KEY="value"` lines in `.env-shared`.

## 10. Set Up Systemd Service

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/markclaw.service << EOF
[Unit]
Description=MarkClaw Personal Assistant
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now markclaw
loginctl enable-linger $USER
```

Check it started:
```bash
systemctl --user status markclaw
```

If it fails, check `logs/markclaw.error.log`.

## 11. Test

Tell the user:

> Send a DM to your MarkClaw bot in Slack. Try something like "hello, are you working?"

Watch the logs:
```bash
tail -f logs/markclaw.log
```

If the bot doesn't respond, check:
1. Is the service running? `systemctl --user status markclaw`
2. Are Slack tokens correct? Check logs for connection errors
3. Is the user ID in `SLACK_ALLOWED_USERS`?
4. Did the bot connect? Look for "Connected to Slack" in logs

## Done

Tell the user:
- Web UI is at `http://localhost:8080` (basic auth, default `user:pass` — change in `.env` via `WEB_UI_USER` and `WEB_UI_PASS`)
- Agent behavior is configured in `groups/global/CLAUDE.md`
- Tool credentials go in `groups/global/.env-shared`
- Logs are in `logs/markclaw.log`
