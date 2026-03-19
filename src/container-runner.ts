/**
 * Container Runner for MarkClaw
 * Spawns agent execution in containers and handles IPC
 */
import { ChildProcess, exec, execSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  CONTAINER_IMAGE,
  CONTAINER_MAX_OUTPUT_SIZE,
  CONTAINER_TIMEOUT,
  DATA_DIR,
  GROUPS_DIR,
  IDLE_TIMEOUT,
  TIMEZONE,
} from './config.js';
import { readEnvFile } from './env.js';
import { resolveGroupFolderPath, resolveGroupIpcPath } from './group-folder.js';
import { logger } from './logger.js';
import {
  CONTAINER_RUNTIME_BIN,
  readonlyMountArgs,
  stopContainer,
} from './container-runtime.js';
import { validateAdditionalMounts } from './mount-security.js';
import { RegisteredGroup } from './types.js';

/**
 * When running inside Docker Compose, mount paths must be translated from
 * container paths (/app/...) to host paths so the Docker daemon can find them.
 * HOST_PROJECT_DIR is set by docker-compose.yml to ${PWD}.
 */
const HOST_PROJECT_DIR = process.env.HOST_PROJECT_DIR;
const HOST_HOME = process.env.HOST_HOME;

function toHostPath(containerPath: string): string {
  if (!HOST_PROJECT_DIR) return containerPath;
  const cwd = process.cwd();
  if (containerPath.startsWith(cwd)) {
    return HOST_PROJECT_DIR + containerPath.slice(cwd.length);
  }
  return containerPath;
}

// Sentinel markers for robust output parsing (must match agent-runner)
const OUTPUT_START_MARKER = '---MARKCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---MARKCLAW_OUTPUT_END---';

export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  modelOverride?: string; // Override ANTHROPIC_MODEL for this run
  secrets?: Record<string, string>;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

// Writable files in the global directory that agents can update.
// Everything else in global/ is mounted read-only.
const GLOBAL_WRITABLE_FILES = [
  'learned-rules.md',
  'COMPANY.md',
  'SOUL.md',
  'TIPS.md',
];

/**
 * Mount the global directory read-only, with writable overlays for
 * specific memory files. Prevents agents from cloning repos or writing
 * arbitrary files into the shared global directory.
 */
function mountGlobalDir(mounts: VolumeMount[]): void {
  const globalDir = path.join(GROUPS_DIR, 'global');
  if (!fs.existsSync(globalDir)) return;

  // Base mount: read-only
  mounts.push({
    hostPath: globalDir,
    containerPath: '/workspace/global',
    readonly: true,
  });

  // Overlay writable files on top of the read-only mount
  for (const filename of GLOBAL_WRITABLE_FILES) {
    const hostFile = path.join(globalDir, filename);
    // Create the file if it doesn't exist so Docker can mount it
    if (!fs.existsSync(hostFile)) {
      fs.writeFileSync(hostFile, '');
    }
    mounts.push({
      hostPath: hostFile,
      containerPath: `/workspace/global/${filename}`,
      readonly: false,
    });
  }
}

function buildVolumeMounts(
  group: RegisteredGroup,
  isMain: boolean,
): VolumeMount[] {
  const mounts: VolumeMount[] = [];
  const projectRoot = process.cwd();
  const groupDir = resolveGroupFolderPath(group.folder);

  if (isMain) {
    // Main gets the project root writable so it can edit MarkClaw code,
    // rebuild, and deploy changes. .env is shadowed separately to protect secrets.
    mounts.push({
      hostPath: projectRoot,
      containerPath: '/workspace/project',
      readonly: false,
    });

    // Shadow .env so the agent cannot read secrets from the mounted project root.
    // Secrets are passed via stdin instead (see readSecrets()).
    const envFile = path.join(projectRoot, '.env');
    if (fs.existsSync(envFile)) {
      mounts.push({
        hostPath: '/dev/null',
        containerPath: '/workspace/project/.env',
        readonly: true,
      });
    }

    // Main also gets its group folder as the working directory
    mounts.push({
      hostPath: groupDir,
      containerPath: '/workspace/group',
      readonly: false,
    });

    // Global directory read-only, with writable overlays for memory files
    mountGlobalDir(mounts);
  } else {
    // Other groups only get their own folder
    mounts.push({
      hostPath: groupDir,
      containerPath: '/workspace/group',
      readonly: false,
    });

    // Global directory read-only, with writable overlays for memory files
    mountGlobalDir(mounts);
  }

  // Shared AWS config — mount a shared .aws dir to ~/.aws for all containers.
  // SSO cache is writable so any session can auth and all others benefit.
  const awsDir = path.join(DATA_DIR, 'shared', 'aws');
  fs.mkdirSync(awsDir, { recursive: true });
  mounts.push({
    hostPath: awsDir,
    containerPath: '/home/node/.aws',
    readonly: false,
  });

  // Per-group Claude sessions directory (isolated from other groups)
  // Each group gets their own .claude/ to prevent cross-group session access
  const groupSessionsDir = path.join(
    DATA_DIR,
    'sessions',
    group.folder,
    '.claude',
  );
  fs.mkdirSync(groupSessionsDir, { recursive: true });

  // Mount host Claude OAuth credentials read-write so containers can refresh
  // the auth token when it expires.
  // HOST_HOME overrides os.homedir() for Docker Compose (where homedir is /root
  // inside the compose container, but agent containers run on the host Docker daemon).
  const hostHome = HOST_HOME || os.homedir();
  const hostCredentials = path.join(hostHome, '.claude', '.credentials.json');
  // When running inside Docker Compose, the file won't exist locally but the
  // path is still valid for agent containers (they mount from the host).
  const credentialsExist = fs.existsSync(hostCredentials) || HOST_HOME;
  if (credentialsExist) {
    mounts.push({
      hostPath: hostCredentials,
      containerPath: '/home/node/.claude/.credentials.json',
      readonly: false,
    });
  }

  const settingsFile = path.join(groupSessionsDir, 'settings.json');

  // Read shared credentials for MCP server config
  const sharedEnvFile = path.join(GROUPS_DIR, 'global', '.env-shared');
  const sharedSecrets: Record<string, string> = {};
  if (fs.existsSync(sharedEnvFile)) {
    for (const line of fs.readFileSync(sharedEnvFile, 'utf-8').split('\n')) {
      const m = line.match(/^export\s+(\w+)="([^"]*)"/);
      if (m) sharedSecrets[m[1]] = m[2];
    }
  }

  // Build MCP servers config from available credentials
  const mcpServers: Record<string, unknown> = {};
  if (sharedSecrets.SLITE_API_KEY) {
    mcpServers.slite = {
      command: 'npx',
      args: ['-y', 'slite-mcp-server'],
      env: { SLITE_API_KEY: sharedSecrets.SLITE_API_KEY },
    };
  }

  // Always regenerate settings so MCP config changes propagate
  fs.writeFileSync(
    settingsFile,
    JSON.stringify(
      {
        env: {
          CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
          CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
          CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
        },
        effortLevel: 'max',
        ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
      },
      null,
      2,
    ) + '\n',
  );

  mounts.push({
    hostPath: groupSessionsDir,
    containerPath: '/home/node/.claude',
    readonly: false,
  });

  // Mount skills read-only (overlays the .claude mount above)
  const skillsSrc = path.join(process.cwd(), 'container', 'skills');
  if (fs.existsSync(skillsSrc)) {
    mounts.push({
      hostPath: skillsSrc,
      containerPath: '/home/node/.claude/skills',
      readonly: false,
    });
  }

  // SSH keys — project-local .ssh/ directory mounted into containers.
  // Generated during setup (see README), gitignored like .env.
  const projectSshDir = path.join(projectRoot, '.ssh');
  if (fs.existsSync(projectSshDir)) {
    mounts.push({
      hostPath: projectSshDir,
      containerPath: '/home/node/.ssh',
      readonly: true,
    });

    // Writable known_hosts per group — overlays the read-only .ssh mount
    // so agents can accept new host keys without "Failed to add host" errors
    const groupKnownHosts = path.join(
      DATA_DIR,
      'sessions',
      group.folder,
      'known_hosts',
    );
    if (!fs.existsSync(groupKnownHosts)) {
      const seedKnownHosts = path.join(projectSshDir, 'known_hosts');
      if (fs.existsSync(seedKnownHosts)) {
        fs.copyFileSync(seedKnownHosts, groupKnownHosts);
      } else {
        fs.writeFileSync(groupKnownHosts, '');
      }
    }
    mounts.push({
      hostPath: groupKnownHosts,
      containerPath: '/home/node/.ssh/known_hosts',
      readonly: false,
    });
  }

  // Per-group IPC namespace: each group gets its own IPC directory
  // This prevents cross-group privilege escalation via IPC
  const groupIpcDir = resolveGroupIpcPath(group.folder);
  fs.mkdirSync(path.join(groupIpcDir, 'messages'), { recursive: true });
  fs.mkdirSync(path.join(groupIpcDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(groupIpcDir, 'input'), { recursive: true });
  mounts.push({
    hostPath: groupIpcDir,
    containerPath: '/workspace/ipc',
    readonly: false,
  });

  // Mount agent-runner source so containers always use the latest code.
  // Recompiled on container startup via entrypoint.sh.
  const agentRunnerSrc = path.join(
    projectRoot,
    'container',
    'agent-runner',
    'src',
  );
  if (fs.existsSync(agentRunnerSrc)) {
    mounts.push({
      hostPath: agentRunnerSrc,
      containerPath: '/app/src',
      readonly: false,
    });
  }

  // Shared Nix store — mount host's /nix so containers can use nix-shell/devbox.
  // Writable because the host's nix-daemon manages the store via its socket
  // (also in /nix). Agents run `nix-shell -p <pkg>` which talks to the daemon.
  if (fs.existsSync('/nix')) {
    mounts.push({
      hostPath: '/nix',
      containerPath: '/nix',
      readonly: false,
    });

    // Per-group Nix profile — persists `nix-env -i` packages across container restarts.
    // nix-env stores profiles at ~/.local/state/nix/profiles/ which is ephemeral
    // inside containers. Mounting a host directory makes installed packages stick.
    const nixProfileDir = path.join(
      DATA_DIR,
      'sessions',
      group.folder,
      'nix-profiles',
    );
    fs.mkdirSync(nixProfileDir, { recursive: true });

    // Seed the profile from the host user's nix profile on first run.
    // This ensures nix-shell and other host-installed nix tools are on PATH
    // immediately without requiring a manual `nix-env -i` in each new session.
    const nixProfileLink = path.join(nixProfileDir, 'profile');
    if (!fs.existsSync(nixProfileLink)) {
      const hostProfile = path.join(
        os.homedir(),
        '.local',
        'state',
        'nix',
        'profiles',
        'profile',
      );
      try {
        // Resolve the full symlink chain (profile → profile-N-link → /nix/store/...)
        const target = fs.realpathSync(hostProfile);
        fs.symlinkSync(target, nixProfileLink);
        logger.debug(
          { group: group.folder, target },
          'Seeded nix profile from host',
        );
      } catch {
        // Host may not have a nix profile — that's fine
      }
    }

    mounts.push({
      hostPath: nixProfileDir,
      containerPath: '/home/node/.local/state/nix/profiles',
      readonly: false,
    });
  }

  // Shared gwcli config — Google Workspace CLI OAuth tokens and profiles.
  // Shared across all containers so OAuth only needs to happen once.
  const gwcliDir = path.join(DATA_DIR, 'gwcli');
  fs.mkdirSync(gwcliDir, { recursive: true });
  mounts.push({
    hostPath: gwcliDir,
    containerPath: '/home/node/.config/gwcli',
    readonly: false,
  });

  // Tailscale CLI (read-only) — gives agents access to `tailscale status` etc.
  // The socket is world-accessible so the non-root node user can query it.
  if (
    fs.existsSync('/usr/bin/tailscale') &&
    fs.existsSync('/var/run/tailscale/tailscaled.sock')
  ) {
    mounts.push({
      hostPath: '/usr/bin/tailscale',
      containerPath: '/usr/local/bin/tailscale',
      readonly: true,
    });
    mounts.push({
      hostPath: '/var/run/tailscale/tailscaled.sock',
      containerPath: '/var/run/tailscale/tailscaled.sock',
      readonly: true,
    });
  }

  // Docker access via socket proxy (build/push only, no run/exec)
  // Proxy runs on localhost:2375, filtering dangerous API endpoints.

  // Additional mounts validated against external allowlist (tamper-proof from containers)
  if (group.containerConfig?.additionalMounts) {
    const validatedMounts = validateAdditionalMounts(
      group.containerConfig.additionalMounts,
      group.name,
      isMain,
    );
    mounts.push(...validatedMounts);
  }

  return mounts;
}

/**
 * Read allowed secrets from .env for passing to the container via stdin.
 * Secrets are never written to disk or mounted as files.
 */
function readSecrets(): Record<string, string> {
  return readEnvFile([
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_MODEL',
    'SLACK_BOT_TOKEN',
  ]);
}

function buildContainerArgs(
  mounts: VolumeMount[],
  containerName: string,
  isMain: boolean,
  group: RegisteredGroup,
): string[] {
  const args: string[] = ['run', '-i', '--rm', '--name', containerName];

  // Host networking so OAuth callbacks (AWS SSO, GitHub CLI, etc.) are reachable.
  args.push('--network', 'host');

  // Pass host timezone so container's local time matches the user's
  args.push('-e', `TZ=${TIMEZONE}`);

  // Block IMDS so agents don't accidentally use the EC2 instance role.
  // Network host is still needed for AWS SSO callback flow.
  args.push('-e', 'AWS_EC2_METADATA_DISABLED=true');

  // Inject shared tool credentials as env vars so agents don't need to source files.
  const sharedEnvFile = path.join(GROUPS_DIR, 'global', '.env-shared');
  if (fs.existsSync(sharedEnvFile)) {
    for (const line of fs.readFileSync(sharedEnvFile, 'utf-8').split('\n')) {
      const m = line.match(/^export\s+(\w+)="([^"]*)"/);
      if (m && m[1] !== 'PATH') {
        args.push('-e', `${m[1]}=${m[2]}`);
      }
    }
  }
  args.push('-e', 'GH_CONFIG_DIR=/home/node/.config/gh');

  // Run as host user so bind-mounted files are accessible.
  // Skip when running as root (uid 0), as the container's node user (uid 1000),
  // or when getuid is unavailable (native Windows without WSL).
  const hostUid = process.getuid?.();
  const hostGid = process.getgid?.();
  if (hostUid != null && hostUid !== 0 && hostUid !== 1000) {
    args.push('--user', `${hostUid}:${hostGid}`);
    args.push('-e', 'HOME=/home/node');
  }

  // Mount Docker socket for agent containers (only when using Docker, not Podman)
  if (CONTAINER_RUNTIME_BIN === 'docker' && fs.existsSync('/var/run/docker.sock')) {
    args.push('-v', '/var/run/docker.sock:/var/run/docker.sock');
    // Auto-detect docker group so the non-root user can access the socket
    try {
      const stat = fs.statSync('/var/run/docker.sock');
      args.push('--group-add', String(stat.gid));
    } catch {
      args.push('--group-add', '993');
    }
    args.push('-e', 'DOCKER_HOST=unix:///var/run/docker.sock');
  }

  for (const mount of mounts) {
    const hostPath = toHostPath(mount.hostPath);
    if (mount.readonly) {
      args.push(...readonlyMountArgs(hostPath, mount.containerPath));
    } else {
      args.push('-v', `${hostPath}:${mount.containerPath}`);
    }
  }

  args.push(CONTAINER_IMAGE);

  return args;
}

export async function runContainerAgent(
  group: RegisteredGroup,
  input: ContainerInput,
  onProcess: (proc: ChildProcess, containerName: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<ContainerOutput> {
  const startTime = Date.now();

  const groupDir = resolveGroupFolderPath(group.folder);
  fs.mkdirSync(groupDir, { recursive: true });

  const mounts = buildVolumeMounts(group, input.isMain);

  // When running as root (e.g. inside Docker Compose), ensure all writable
  // mount directories are accessible to the agent container's node user (UID 1000).
  // Uses chmod 0777 recursively since chown on the top-level dir doesn't cover
  // subdirectories created by prior runs.
  if (process.getuid?.() === 0) {
    for (const mount of mounts) {
      if (mount.readonly) continue;
      try {
        const stat = fs.statSync(mount.hostPath);
        if (stat.isDirectory() && (stat.mode & 0o777) !== 0o777) {
          execSync(`chmod -R 777 ${JSON.stringify(mount.hostPath)}`, {
            stdio: 'pipe',
            timeout: 5000,
          });
        }
      } catch {
        // File may not exist yet or be a special path — skip
      }
    }
  }
  const safeName = group.folder.replace(/[^a-zA-Z0-9-]/g, '-');
  const containerName = `markclaw-${safeName}-${Date.now()}`;
  const containerArgs = buildContainerArgs(
    mounts,
    containerName,
    input.isMain,
    group,
  );

  logger.debug(
    {
      group: group.name,
      containerName,
      mounts: mounts.map(
        (m) =>
          `${m.hostPath} -> ${m.containerPath}${m.readonly ? ' (ro)' : ''}`,
      ),
      containerArgs: containerArgs.join(' '),
    },
    'Container mount configuration',
  );

  logger.info(
    {
      group: group.name,
      containerName,
      mountCount: mounts.length,
      isMain: input.isMain,
    },
    'Spawning container agent',
  );

  const logsDir = path.join(groupDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  return new Promise((resolve) => {
    const container = spawn(CONTAINER_RUNTIME_BIN, containerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    onProcess(container, containerName);

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;

    // Pass secrets via stdin (never written to disk or mounted as files)
    input.secrets = readSecrets();
    // Model override (per-schedule or per-session) takes priority over .env default
    if (input.modelOverride) {
      input.secrets.ANTHROPIC_MODEL = input.modelOverride;
    }
    logger.info(
      {
        group: group.name,
        model: input.secrets.ANTHROPIC_MODEL,
        isMain: input.isMain,
      },
      'Container model selected',
    );
    container.stdin.write(JSON.stringify(input));
    container.stdin.end();
    // Remove secrets from input so they don't appear in logs
    delete input.secrets;

    // Streaming output: parse OUTPUT_START/END marker pairs as they arrive
    let parseBuffer = '';
    let newSessionId: string | undefined;
    let outputChain = Promise.resolve();

    container.stdout.on('data', (data) => {
      const chunk = data.toString();

      // Always accumulate for logging
      if (!stdoutTruncated) {
        const remaining = CONTAINER_MAX_OUTPUT_SIZE - stdout.length;
        if (chunk.length > remaining) {
          stdout += chunk.slice(0, remaining);
          stdoutTruncated = true;
          logger.warn(
            { group: group.name, size: stdout.length },
            'Container stdout truncated due to size limit',
          );
        } else {
          stdout += chunk;
        }
      }

      // Stream-parse for output markers
      if (onOutput) {
        parseBuffer += chunk;
        let startIdx: number;
        while ((startIdx = parseBuffer.indexOf(OUTPUT_START_MARKER)) !== -1) {
          const endIdx = parseBuffer.indexOf(OUTPUT_END_MARKER, startIdx);
          if (endIdx === -1) break; // Incomplete pair, wait for more data

          const jsonStr = parseBuffer
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
          parseBuffer = parseBuffer.slice(endIdx + OUTPUT_END_MARKER.length);

          try {
            const parsed: ContainerOutput = JSON.parse(jsonStr);
            if (parsed.newSessionId) {
              newSessionId = parsed.newSessionId;
            }
            hadStreamingOutput = true;
            // Activity detected — reset the hard timeout
            resetTimeout();
            // Call onOutput for all markers (including null results)
            // so idle timers start even for "silent" query completions.
            outputChain = outputChain.then(() => onOutput(parsed));
          } catch (err) {
            logger.warn(
              { group: group.name, error: err },
              'Failed to parse streamed output chunk',
            );
          }
        }
      }
    });

    container.stderr.on('data', (data) => {
      const chunk = data.toString();
      const lines = chunk.trim().split('\n');
      for (const line of lines) {
        if (line) logger.debug({ container: group.folder }, line);
      }
      // Don't reset timeout on stderr — SDK writes debug logs continuously.
      // Timeout only resets on actual output (OUTPUT_MARKER in stdout).
      if (stderrTruncated) return;
      const remaining = CONTAINER_MAX_OUTPUT_SIZE - stderr.length;
      if (chunk.length > remaining) {
        stderr += chunk.slice(0, remaining);
        stderrTruncated = true;
        logger.warn(
          { group: group.name, size: stderr.length },
          'Container stderr truncated due to size limit',
        );
      } else {
        stderr += chunk;
      }
    });

    let timedOut = false;
    let hadStreamingOutput = false;
    const configTimeout = group.containerConfig?.timeout || CONTAINER_TIMEOUT;
    // Grace period: hard timeout must be at least IDLE_TIMEOUT + 30s so the
    // graceful _close sentinel has time to trigger before the hard kill fires.
    const timeoutMs = Math.max(configTimeout, IDLE_TIMEOUT + 30_000);

    const killOnTimeout = () => {
      timedOut = true;
      logger.error(
        { group: group.name, containerName },
        'Container timeout, stopping gracefully',
      );
      exec(stopContainer(containerName), { timeout: 15000 }, (err) => {
        if (err) {
          logger.warn(
            { group: group.name, containerName, err },
            'Graceful stop failed, force killing',
          );
          container.kill('SIGKILL');
        }
      });
    };

    let timeout = setTimeout(killOnTimeout, timeoutMs);

    // Reset the timeout whenever there's activity (streaming output)
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(killOnTimeout, timeoutMs);
    };

    container.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      if (timedOut) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const timeoutLog = path.join(logsDir, `container-${ts}.log`);
        fs.writeFileSync(
          timeoutLog,
          [
            `=== Container Run Log (TIMEOUT) ===`,
            `Timestamp: ${new Date().toISOString()}`,
            `Group: ${group.name}`,
            `Container: ${containerName}`,
            `Duration: ${duration}ms`,
            `Exit Code: ${code}`,
            `Had Streaming Output: ${hadStreamingOutput}`,
          ].join('\n'),
        );

        // Timeout after output = idle cleanup, not failure.
        // The agent already sent its response; this is just the
        // container being reaped after the idle period expired.
        if (hadStreamingOutput) {
          logger.info(
            { group: group.name, containerName, duration, code },
            'Container timed out after output (idle cleanup)',
          );
          outputChain.then(() => {
            resolve({
              status: 'success',
              result: null,
              newSessionId,
            });
          });
          return;
        }

        logger.error(
          { group: group.name, containerName, duration, code },
          'Container timed out with no output',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Container timed out after ${configTimeout}ms`,
        });
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logsDir, `container-${timestamp}.log`);
      const isVerbose =
        process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace';

      const logLines = [
        `=== Container Run Log ===`,
        `Timestamp: ${new Date().toISOString()}`,
        `Group: ${group.name}`,
        `IsMain: ${input.isMain}`,
        `Duration: ${duration}ms`,
        `Exit Code: ${code}`,
        `Stdout Truncated: ${stdoutTruncated}`,
        `Stderr Truncated: ${stderrTruncated}`,
        ``,
      ];

      const isError = code !== 0;

      if (isVerbose || isError) {
        logLines.push(
          `=== Input ===`,
          JSON.stringify(input, null, 2),
          ``,
          `=== Container Args ===`,
          containerArgs.join(' '),
          ``,
          `=== Mounts ===`,
          mounts
            .map(
              (m) =>
                `${m.hostPath} -> ${m.containerPath}${m.readonly ? ' (ro)' : ''}`,
            )
            .join('\n'),
          ``,
          `=== Stderr${stderrTruncated ? ' (TRUNCATED)' : ''} ===`,
          stderr,
          ``,
          `=== Stdout${stdoutTruncated ? ' (TRUNCATED)' : ''} ===`,
          stdout,
        );
      } else {
        logLines.push(
          `=== Input Summary ===`,
          `Prompt length: ${input.prompt.length} chars`,
          `Session ID: ${input.sessionId || 'new'}`,
          ``,
          `=== Mounts ===`,
          mounts
            .map((m) => `${m.containerPath}${m.readonly ? ' (ro)' : ''}`)
            .join('\n'),
          ``,
        );
      }

      fs.writeFileSync(logFile, logLines.join('\n'));
      logger.debug({ logFile, verbose: isVerbose }, 'Container log written');

      if (code !== 0) {
        logger.error(
          {
            group: group.name,
            code,
            duration,
            stderr,
            stdout,
            logFile,
          },
          'Container exited with error',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Container exited with code ${code}: ${stderr.slice(-200)}`,
        });
        return;
      }

      // Streaming mode: wait for output chain to settle, return completion marker
      if (onOutput) {
        outputChain.then(() => {
          logger.info(
            { group: group.name, duration, newSessionId },
            'Container completed (streaming mode)',
          );
          resolve({
            status: 'success',
            result: null,
            newSessionId,
          });
        });
        return;
      }

      // Legacy mode: parse the last output marker pair from accumulated stdout
      try {
        // Extract JSON between sentinel markers for robust parsing
        const startIdx = stdout.indexOf(OUTPUT_START_MARKER);
        const endIdx = stdout.indexOf(OUTPUT_END_MARKER);

        let jsonLine: string;
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonLine = stdout
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
        } else {
          // Fallback: last non-empty line (backwards compatibility)
          const lines = stdout.trim().split('\n');
          jsonLine = lines[lines.length - 1];
        }

        const output: ContainerOutput = JSON.parse(jsonLine);

        logger.info(
          {
            group: group.name,
            duration,
            status: output.status,
            hasResult: !!output.result,
          },
          'Container completed',
        );

        resolve(output);
      } catch (err) {
        logger.error(
          {
            group: group.name,
            stdout,
            stderr,
            error: err,
          },
          'Failed to parse container output',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Failed to parse container output: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });

    container.on('error', (err) => {
      clearTimeout(timeout);
      logger.error(
        { group: group.name, containerName, error: err },
        'Container spawn error',
      );
      resolve({
        status: 'error',
        result: null,
        error: `Container spawn error: ${err.message}`,
      });
    });
  });
}

export function writeTasksSnapshot(
  groupFolder: string,
  isMain: boolean,
  tasks: Array<{
    id: string;
    groupFolder: string;
    prompt: string;
    schedule_type: string;
    schedule_value: string;
    status: string;
    next_run: string | null;
  }>,
): void {
  // Write filtered tasks to the group's IPC directory
  const groupIpcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  // Main sees all tasks, others only see their own
  const filteredTasks = isMain
    ? tasks
    : tasks.filter((t) => t.groupFolder === groupFolder);

  const tasksFile = path.join(groupIpcDir, 'current_tasks.json');
  fs.writeFileSync(tasksFile, JSON.stringify(filteredTasks, null, 2));
}

export interface AvailableGroup {
  jid: string;
  name: string;
  lastActivity: string;
  isRegistered: boolean;
}

/**
 * Write available groups snapshot for the container to read.
 * Only main group can see all available groups (for activation).
 * Non-main groups only see their own registration status.
 */
export function writeGroupsSnapshot(
  groupFolder: string,
  isMain: boolean,
  groups: AvailableGroup[],
  registeredJids: Set<string>,
): void {
  const groupIpcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  // Main sees all groups; others see nothing (they can't activate groups)
  const visibleGroups = isMain ? groups : [];

  const groupsFile = path.join(groupIpcDir, 'available_groups.json');
  fs.writeFileSync(
    groupsFile,
    JSON.stringify(
      {
        groups: visibleGroups,
        lastSync: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
