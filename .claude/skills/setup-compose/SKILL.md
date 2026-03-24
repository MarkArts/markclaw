---
name: setup-compose
description: Set up MarkClaw using Docker Compose for local development. Walks through prerequisites, .env configuration, container builds, and first run. Slack is optional.
---

# MarkClaw Docker Compose Setup

Interactive setup for running MarkClaw via Docker Compose. This is the simplest way to get started — no Node.js, systemd, or nvm needed on the host. Just Docker.

**Principle:** Fix things yourself. Don't tell the user to go run commands — run them. Only ask the user to do things that require their browser or their credentials.

## 1. Prerequisites Check

Check what's already in place:

```bash
docker --version                    # Need Docker
docker compose version              # Need Docker Compose v2
docker info >/dev/null 2>&1         # Need Docker running
ls .env 2>/dev/null                 # Existing config?
ls ~/.claude/.credentials.json 2>/dev/null  # Claude auth?
```

If Docker is not installed or not running, tell the user to install Docker Desktop (or Docker Engine + Compose plugin) and start it before continuing.

If `docker compose version` fails, they need Docker Compose v2 (comes with Docker Desktop, or install the `docker-compose-plugin` package).

## 2. Claude Authentication

Claude Code OAuth is required — API keys are not supported.

Check if credentials exist:
```bash
ls ~/.claude/.credentials.json 2>/dev/null
```

If not, tell the user:

> You need to authenticate Claude Code first. Run this in a separate terminal:
> ```
> npx @anthropic-ai/claude-code /login
> ```
> This creates `~/.claude/.credentials.json` which gets mounted into agent containers.

Use AskUserQuestion to confirm they've completed the login.

## 3. Configure .env

Check if `.env` already exists. If not, copy the example:
```bash
cp .env.example .env
```

### Required settings

Use AskUserQuestion: **Which Claude model do you want to use?** (default: `claude-sonnet-4-6`, options: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`)

Write the model to `.env` as `ANTHROPIC_MODEL=<model>`.

### Web UI credentials

Use AskUserQuestion: **Set a username and password for the web UI** (default: `admin` / `changeminprod`)

Write to `.env` as `WEB_UI_USER=<user>` and `WEB_UI_PASS=<pass>`.

### Timezone

Detect the system timezone and suggest it as the default:
```bash
timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo "UTC"
```
Ask the user to confirm or provide their timezone (e.g. `Europe/Amsterdam`, `America/New_York`). Write it to `.env` as `TZ=<timezone>`.

### Slack (optional)

Use AskUserQuestion: **Do you want to connect a Slack bot?** (you can skip this and use the web UI only)

If yes, walk them through:

1. Go to https://api.slack.com/apps → **Create New App** → **From a manifest**
2. Select workspace, switch to **JSON** tab, paste contents of `slack-app-manifest.json`
3. Click **Create**, then **Install to Workspace** and approve
4. Copy the **Bot User OAuth Token** (`xoxb-...`) from **OAuth & Permissions**
5. Go to **Basic Information** → **App-Level Tokens** → **Generate Token** with scope `connections:write` → copy it (`xapp-...`)
6. In Slack, click profile → **Profile** → three dots (⋯) → **Copy member ID**

Use AskUserQuestion to collect:
- `xoxb-` bot token
- `xapp-` app-level token
- Slack user ID (starts with `U`)

Write to `.env`:
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_ALLOWED_USERS=U...
```

If no, confirm the web UI will be available at `http://localhost:8080` and move on.

### Dashboard integrations (optional)

Ask if they want to set `GITHUB_ORG` and `JIRA_SITE` for the web UI dashboard. If yes, collect and write to `.env`.

## 4. Build the Agent Container

```bash
docker build -t markclaw-agent container/
```

This builds the image with all tools pre-installed (gh, aws, heroku, jira, chromium, nix, claude-code). It takes a few minutes on first build.

If it fails, check Docker is running and retry.

## 5. Start MarkClaw

```bash
docker compose up -d
```

Wait for it to start, then check:
```bash
docker compose logs --tail=20
```

Look for "Web UI started on http://localhost:8080" and optionally "Connected to Slack".

## 6. Load Agent Image into Podman

The compose container uses Podman internally to spawn agent containers. The agent image needs to be loaded into Podman:

```bash
docker save markclaw-agent | docker compose exec -T markclaw podman load
```

Verify it loaded:
```bash
docker compose exec markclaw podman images
```

You should see `localhost/markclaw-agent` in the list.

## 7. Generate SSH Keys (optional)

Ask if they want agents to have SSH access (needed for `git clone` over SSH, GitHub deploy keys, etc.).

If yes:
```bash
mkdir -p .ssh
ssh-keygen -t ed25519 -N "" -f .ssh/id_ed25519 -C "markclaw-agent"
ssh-keyscan github.com >> .ssh/known_hosts 2>/dev/null
chmod 700 .ssh && chmod 600 .ssh/*
```

Show the public key and tell them:
> Add this public key to your GitHub account at https://github.com/settings/ssh/new

Note: the `.ssh/` directory is automatically mounted into agent containers.

## 8. Tool Credentials (optional)

Ask if they want to set up tool credentials for agents. If yes:

```bash
mkdir -p groups/global
cp groups/global/.env-shared.example groups/global/.env-shared 2>/dev/null || touch groups/global/.env-shared
```

Ask which tools they use and collect tokens:
- `GH_TOKEN` — GitHub personal access token
- `SENTRY_AUTH_TOKEN` — Sentry
- `JIRA_API_TOKEN` + `JIRA_SITE` + `JIRA_USER` — Jira
- `HEROKU_API_KEY` — Heroku
- `SLITE_API_KEY` — Slite

Write each as `export KEY="value"` lines in `groups/global/.env-shared`.

## 9. Test

Tell the user:

> Open http://localhost:8080 in your browser and log in with the credentials you set.

If Slack is configured:
> Send a DM to your bot in Slack. Try something like "hello, are you working?"

Watch the logs:
```bash
docker compose logs -f --tail=50
```

If something's wrong, check:
1. Is the container running? `docker compose ps`
2. Any errors? `docker compose logs --tail=50`
3. Is the agent image loaded? `docker compose exec markclaw podman images`
4. Slack not connecting? Check tokens in `.env`

## Done

Tell the user:
- Web UI: `http://localhost:8080`
- Agent behavior: edit `groups/global/CLAUDE.md`
- Tool credentials: `groups/global/.env-shared`
- Logs: `docker compose logs -f`
- Restart: `docker compose restart`
- Stop: `docker compose down`
- After changing `.env`: `docker compose up -d` (recreates the container)
- After rebuilding the agent image: re-run `docker save markclaw-agent | docker compose exec -T markclaw podman load`
