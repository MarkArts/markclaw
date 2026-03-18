# MarkClaw

A personal Claude assistant that runs on a single EC2 instance. You talk to it via Slack, it runs Claude agents in Docker containers with full tool access (AWS, GitHub, Jira, Heroku, etc.), and it remembers everything across sessions.

Opinionated for a single-user production setup.

## What it does

- **Slack DM as the interface** — message your assistant, it spawns a Claude agent in a Docker container to handle it
- **Thread-based tasks** — complex work gets its own Slack thread with a dedicated agent session
- **Scheduled tasks** — recurring cron jobs that run Claude agents (e.g. daily briefings, CI monitoring)
- **Per-group memory** — each conversation has its own `CLAUDE.md` that the agent reads and writes to
- **Tool access** — agents have `gh`, `aws`, `heroku`, `jira`, Grafana, Sentry, Slite, Google Workspace CLI, all pre-authenticated
- **Web UI** — basic dashboard on port 8080 for monitoring sessions, tasks, and rate limits

## Opinionated choices

- **Single user, single instance.** No multi-tenancy. One EC2 box, one Slack workspace, one person.
- **Docker containers for isolation.** Each agent runs in its own container with only mounted directories accessible. Bash access is safe because it runs inside the container, not on the host.
- **Claude Code CLI as subprocess.** Agents run `claude` as a long-lived subprocess with `--input-format stream-json` / `--output-format stream-json`. This gives native Claude Code behavior (settings, effort level, CLAUDE.md loading) without the SDK abstraction layer.
- **effortLevel: max.** All agents run with maximum thinking effort. This costs more but dramatically improves instruction-following.
- **No config files.** Want different behavior? Modify the code. The codebase is small enough that Claude can safely change it.
- **Skills over features.** New capabilities are added as Claude Code skills (`/add-slack`, `/customize`) that transform the codebase, not as config toggles.
- **Shared Nix store.** Host's `/nix` is mounted into containers so agents can `nix-shell -p <pkg>` for any tool they need.

## Architecture

```
Slack (Socket Mode) → Node.js process → SQLite → Docker container (claude CLI) → IPC → Slack
```

Single Node.js process handles Slack events, queues messages per group, spawns Docker containers for agent execution, and processes IPC output (messages, reactions, scheduled tasks) back to Slack.

Key files:

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/slack.ts` | Slack channel (Socket Mode) |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `src/web-ui.ts` | Web UI backend (port 8080) |
| `container/agent-runner/` | Code that runs inside each container |
| `groups/global/CLAUDE.md` | Global agent instructions (all sessions) |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |

## Setup

### Prerequisites

- EC2 instance (or any Linux box) with Docker installed
- Node.js 22+ (via nvm)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed globally
- A Slack app with Socket Mode enabled

### 1. Clone and install

```bash
git clone <this-repo> MarkClaw
cd MarkClaw
npm install
```

### 2. Create `.env`

```bash
cp .env.example .env
```

Fill in:
- `SLACK_BOT_TOKEN` — Slack bot token (`xoxb-...`)
- `SLACK_APP_TOKEN` — Slack app-level token (`xapp-...`)
- `ANTHROPIC_API_KEY` or run `claude /login` for OAuth
- `ANTHROPIC_MODEL` — model to use (default: `claude-sonnet-4-6`)
- `SLACK_ALLOWED_USERS` — your Slack user ID

### 3. Create the Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**
2. Select your workspace, switch to the **JSON** tab, paste the contents of [`slack-app-manifest.json`](slack-app-manifest.json)
3. Click **Create**, then **Install to Workspace** and approve
4. Copy the **Bot User OAuth Token** (`xoxb-...`) from **OAuth & Permissions** → this is your `SLACK_BOT_TOKEN`
5. Go to **Basic Information** → **App-Level Tokens** → **Generate Token** with scope `connections:write` → this is your `SLACK_APP_TOKEN`
6. Find your Slack user ID (profile → three dots → Copy member ID) → this is your `SLACK_ALLOWED_USERS`

### 4. Build the agent container

```bash
./container/build.sh
```

This builds the Docker image (`markclaw-agent:latest`) with all tools pre-installed: `gh`, `aws`, `heroku`, `jira`, Chromium, Nix, and Claude Code.

### 5. Build and run

```bash
npm run build
node dist/index.js
```

### 6. Set up as a systemd service (optional)

```bash
cat > ~/.config/systemd/user/markclaw.service << 'EOF'
[Unit]
Description=MarkClaw Personal Assistant
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/home/ec2-user/MarkClaw
ExecStart=/home/ec2-user/.nvm/versions/node/v22.22.0/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now markclaw
loginctl enable-linger $USER
```

### 7. Generate SSH keys for agents

```bash
mkdir -p .ssh
ssh-keygen -t ed25519 -N "" -f .ssh/id_ed25519 -C "markclaw-agent"
ssh-keyscan github.com >> .ssh/known_hosts 2>/dev/null
chmod 700 .ssh && chmod 600 .ssh/*
```

Add the public key (`.ssh/id_ed25519.pub`) to your GitHub account or as a deploy key on your repos. The `.ssh/` directory is gitignored.

### 8. Add tool credentials (optional)

Edit `groups/global/.env-shared` with credentials for tools your agents should have access to:

```bash
export GH_TOKEN="github_pat_..."
export SENTRY_AUTH_TOKEN="sntryu_..."
export JIRA_API_TOKEN="..."
export JIRA_SITE="https://your-org.atlassian.net"
export JIRA_USER="you@company.com"
export HEROKU_API_KEY="..."
# etc.
```

These are injected as environment variables into every agent container.

### 9. Configure agent behavior

Edit `groups/global/CLAUDE.md` — this is loaded by every agent session. It defines how agents communicate (via MCP tools, not text output), tool-specific instructions (AWS SSO flow, GitHub conventions), and behavioral rules.

## Development

```bash
source ~/.nvm/nvm.sh
npm run build              # Compile TypeScript
./container/build.sh       # Rebuild agent container
systemctl --user restart markclaw
```

The agent-runner source (`container/agent-runner/src/`) is mounted into containers and recompiled on each container start, so changes there don't require a container rebuild.

## Quick start with Docker Compose

If you just want to try it out:

```bash
git clone https://github.com/MarkArts/markclaw.git && cd markclaw
cp .env.example .env        # fill in Slack tokens + Anthropic key
./container/build.sh         # build the agent container image
docker compose up -d         # start markclaw
```

You still need to create the Slack app first (step 3 above) and fill in `.env`. The agent container image must be built on the host since markclaw spawns containers via the Docker socket.

## Known issues

- **Agent sometimes doesn't reply in Slack.** The agent is *instructed* to use the `send_message` MCP tool — it's not hardcoded. Occasionally it forgets, especially on simple messages. You can check the web UI to see if it processed the message, or just remind it to reply.
- **Inbox feature is unreliable.** The web UI inbox doesn't work consistently at the moment.
- **Cost tracking is API-only.** The cost dashboard tracks API token usage but doesn't account for subscription-based plans (Pro/Max). If you're on a subscription, the numbers won't reflect your actual spend.

## License

MIT
