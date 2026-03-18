# MarkClaw

A personal Claude assistant. You talk to it via Slack or the web UI, it runs Claude agents in Docker containers with full tool access (AWS, GitHub, Jira, Heroku, etc.), and it remembers everything across sessions.

Opinionated for a single-user production setup.

## What it does

- **Slack DM or web UI** — message your assistant via Slack (default) or the built-in web UI on port 8080
- **Thread-based tasks** — complex work gets its own Slack thread with a dedicated agent session
- **Scheduled tasks** — recurring cron jobs that run Claude agents (e.g. daily briefings, CI monitoring)
- **Per-group memory** — each conversation has its own `CLAUDE.md` that the agent reads and writes to
- **Tool access** — agents have `gh`, `aws`, `heroku`, `jira`, Sentry, Slite, Google Workspace CLI, all pre-authenticated
- **Web UI** — dashboard for monitoring sessions, tasks, rate limits, and starting conversations

## Opinionated choices

- **Single user, single instance.** No multi-tenancy, no shared access.
- **Docker containers for isolation.** Each agent runs in its own container with only mounted directories accessible. Bash access is safe because it runs inside the container, not on the host.
- **Claude Code CLI as subprocess.** Agents run `claude` as a long-lived subprocess with `--input-format stream-json` / `--output-format stream-json`. This gives native Claude Code behavior (settings, CLAUDE.md loading, tools) without an abstraction layer.
- **OAuth only.** Agents authenticate via Claude Code OAuth (`~/.claude/.credentials.json`), not API keys. Run `claude /login` on the host before starting.
- **No config files.** Want different behavior? Modify the code. The codebase is small enough that Claude can safely change it.
- **Shared Nix store.** Host's `/nix` is mounted into containers so agents can `nix-shell -p <pkg>` for any tool they need.

## Architecture

```
Input (Slack / Web UI) → Node.js process → SQLite → Docker container (claude CLI) → IPC → Output
```

Single Node.js process handles events, queues messages per group, spawns Docker containers for agent execution, and processes IPC output (messages, reactions, scheduled tasks) back to the user.

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

- Linux or macOS with Docker installed
- Node.js 22+ (via nvm)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and logged in (`claude /login`)

### 1. Clone and install

```bash
git clone https://github.com/MarkArts/markclaw.git
cd markclaw
npm install
```

### 2. Authenticate Claude

Run `claude /login` on the host to create `~/.claude/.credentials.json`. This gets mounted into every agent container. API keys are not supported — agents need full Claude Code OAuth auth.

### 3. Create `.env`

```bash
cp .env.example .env
```

Fill in at minimum:
- `ANTHROPIC_MODEL` — model to use (default: `claude-sonnet-4-6`)

Slack is optional. Without it, use the web UI on port 8080 to start conversations.

### 4. Set up Slack (optional)

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**
2. Select your workspace, switch to the **JSON** tab, paste the contents of [`slack-app-manifest.json`](slack-app-manifest.json)
3. Click **Create**, then **Install to Workspace** and approve
4. Copy the **Bot User OAuth Token** (`xoxb-...`) from **OAuth & Permissions** → add to `.env` as `SLACK_BOT_TOKEN`
5. Go to **Basic Information** → **App-Level Tokens** → **Generate Token** with scope `connections:write` → add to `.env` as `SLACK_APP_TOKEN`
6. Find your Slack user ID (profile → three dots → Copy member ID) → add to `.env` as `SLACK_ALLOWED_USERS`

### 5. Build the agent container

```bash
./container/build.sh
```

This builds the Docker image (`markclaw-agent:latest`) with all tools pre-installed: `gh`, `aws`, `heroku`, `jira`, Chromium, Nix, and Claude Code.

### 6. Build and run

```bash
npm run build
node dist/index.js
```

The web UI is available at `http://localhost:8080`.

### 7. Generate SSH keys for agents (optional)

```bash
mkdir -p .ssh
ssh-keygen -t ed25519 -N "" -f .ssh/id_ed25519 -C "markclaw-agent"
ssh-keyscan github.com >> .ssh/known_hosts 2>/dev/null
chmod 700 .ssh && chmod 600 .ssh/*
```

Add the public key (`.ssh/id_ed25519.pub`) to your GitHub account or as a deploy key. The `.ssh/` directory is gitignored.

### 8. Add tool credentials (optional)

```bash
cp groups/global/.env-shared.example groups/global/.env-shared
```

Edit `groups/global/.env-shared` and uncomment/fill in credentials for the tools you use. See the example file for all supported tools. These are injected as environment variables into every agent container.

### 9. Configure agent behavior

Edit `groups/global/CLAUDE.md` — this is loaded by every agent session. It defines how agents communicate (via MCP tools, not text output), tool-specific instructions, and behavioral rules.

### 10. Set up as a systemd service (optional)

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/markclaw.service << EOF
[Unit]
Description=MarkClaw Personal Assistant
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now markclaw
loginctl enable-linger $USER
```

## Quick start with Docker Compose

```bash
git clone https://github.com/MarkArts/markclaw.git && cd markclaw
claude /login                # authenticate Claude Code on the host
cp .env.example .env         # optionally add Slack tokens
./container/build.sh         # build the agent container image
docker compose up -d         # start markclaw
```

The web UI is at `http://localhost:8080`. Slack is optional — without tokens, MarkClaw runs in web-UI-only mode.

The agent container image must be built on the host since MarkClaw spawns containers via the Docker socket (Docker-in-Docker).

## Development

```bash
npm run build              # Compile TypeScript
./container/build.sh       # Rebuild agent container
systemctl --user restart markclaw
```

The agent-runner source (`container/agent-runner/src/`) is mounted into containers and recompiled on each container start, so changes there don't require a container rebuild.

## Known issues

- **Agent sometimes doesn't reply in Slack.** The agent is *instructed* to use the `send_message` MCP tool — it's not hardcoded. Occasionally it forgets, especially on simple messages. You can check the web UI to see if it processed the message, or just remind it to reply.
- **Inbox feature is unreliable.** The web UI inbox doesn't work consistently at the moment.
- **Cost tracking is API-only.** The cost dashboard tracks API token usage but doesn't account for subscription-based plans (Pro/Max). If you're on a subscription, the numbers won't reflect your actual spend.

## License

MIT
