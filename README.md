# MarkClaw

A personal Claude assistant. You talk to it via Slack or the web UI, it runs Claude agents in Docker containers with full tool access (AWS, GitHub, Jira, Heroku, etc.), and it remembers everything across sessions.

Opinionated for a single-user production setup.

## What it does

- **Slack DM or web UI** — message your assistant via Slack (default) or the built-in web UI on port 8080
- **Thread-based tasks** — Every slack thread is it's own session
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
- **Clone and evolve.** The intended workflow is to clone this repo and then run a Claude Code session in the project root to make the changes or fixes you want. The codebase is designed to be modified by AI.
- **Shared Nix store.** Host's `/nix` is mounted into containers so agents can `nix-shell -p <pkg>` for any tool they need.
- **Don't run this on the public internet**  The webui uses basic auth. Do not expect this to be safe to run without a vpn

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

```bash
git clone https://github.com/MarkArts/markclaw.git
cd markclaw
claude
```

Then tell Claude to run `/setup`. It will walk you through dependencies, Slack app creation, credentials, SSH keys, container build, and service configuration.

For manual setup steps, check the `/setup` skill in `.claude/skills/setup.md`.

## Quick start with Docker Compose

```bash
git clone https://github.com/MarkArts/markclaw.git && cd markclaw
cp .env.example .env                              # optionally add Slack tokens
docker build -t markclaw-agent container/         # build the agent image
docker compose up -d                              # start markclaw
docker save markclaw-agent | docker compose exec -T markclaw podman load  # load agent image into Podman
```

The web UI is at `http://localhost:8080` (default login: `admin` / `changeminprod`).

Slack is optional — without tokens, MarkClaw runs in web-UI-only mode.

The compose container uses Podman internally to spawn agent containers (no Docker socket mounting needed). The agent image must be loaded into Podman after the container starts.

## Development

```bash
npm run build              # Compile TypeScript
docker build -t markclaw-agent container/       # Rebuild agent container
systemctl --user restart markclaw
```

The agent-runner source (`container/agent-runner/src/`) is mounted into containers and recompiled on each container start, so changes there don't require a container rebuild.

## Known issues

- **Agent sometimes doesn't reply in Slack.** The agent is *instructed* to use the `send_message` MCP tool — it's not hardcoded. Occasionally it forgets, especially on simple messages. You can check the web UI to see if it processed the message, or just remind it to reply.
- **Cost tracking is API-only.** The cost dashboard tracks API token usage but doesn't account for subscription-based plans (Pro/Max). If you're on a subscription, the numbers won't reflect your actual spend.

## License

MIT
