# MarkClaw

Single Node.js process, Slack channel (Socket Mode), Docker containers for agents. EC2 (eu-west-1), Linux/systemd.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/registry.ts` | Channel registry (self-registration at startup) |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `src/web-ui.ts` | Web UI backend (port 8080, basic auth) |
| `public/index.html` | Web UI frontend (single-page app) |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |

## Development

Run commands directly — don't tell the user to run them.

```bash
source ~/.nvm/nvm.sh
npm run build              # Compile TypeScript
docker build -t markclaw-agent container/       # Rebuild agent container
systemctl --user restart markclaw
```

## Testing the Web UI

After changing `public/index.html`, verify no runtime JS errors with jsdom (`cd /tmp && npm install jsdom` once):

```bash
NODE_PATH=/tmp/node_modules node -e "
const { JSDOM, VirtualConsole } = require('jsdom');
const http = require('http');
http.get({ hostname: 'localhost', port: 8080, path: '/',
  headers: { 'Authorization': 'Basic ' + Buffer.from('mark:mark').toString('base64') }
}, res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => {
    const errs = []; const vc = new VirtualConsole();
    vc.on('error', e => errs.push(e)); vc.on('jsdomError', e => errs.push(e.message || e));
    const dom = new JSDOM(d, { url: 'http://localhost:8080/', runScripts: 'dangerously',
      virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
        w.fetch = async u => ({ json: async () => ([]), ok: true, text: async () => '' });
        w.EventSource = class { constructor(){} close(){} addEventListener(){} };
        w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect:()=>{},fillRect:()=>{},beginPath:()=>{},arc:()=>{},fill:()=>{},fillStyle:'' });
        w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
      }});
    setTimeout(() => { console.log(errs.length ? 'ERRORS: ' + errs.join('; ') : 'OK'); dom.window.close(); }, 3000);
  });
});
"
```

## Container Build Cache

Buildkit caches aggressively. `--no-cache` alone does NOT invalidate COPY steps. To force a clean rebuild, prune the builder then re-run `docker build -t markclaw-agent container/`.
