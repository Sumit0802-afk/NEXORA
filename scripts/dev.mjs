// Starts the API (port 8000) and the web app (port 3000) together: `npm run dev`.
// Ctrl+C stops both; if either one exits, the other is stopped too.
import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "services", "api");
const isWin = process.platform === "win32";
const venvPython = path.join(apiDir, ".venv", isWin ? "Scripts/python.exe" : "bin/python");

if (!existsSync(venvPython)) {
  console.error(`[dev] API virtualenv not found at ${venvPython}.`);
  console.error("[dev] Create it once: cd services/api && python -m venv .venv && .venv/Scripts/pip install -e .[dev]");
  process.exit(1);
}

// uvicorn --reload restarts the API by signalling the console it shares with this script. On Windows that Ctrl+C
// also reaches npm ("Terminate batch job?") and stops BOTH servers on every Python edit. So on Windows the API runs
// without --reload and this script restarts only the API process itself when a backend .py file changes.
const uvicornReload = !isWin;

const services = [
  { name: "api", color: "\x1b[35m", cmd: venvPython, args: ["-m", "uvicorn", "app.main:app", "--port", "8000", ...(uvicornReload ? ["--reload"] : [])], cwd: apiDir },
  { name: "web", color: "\x1b[36m", cmd: "npm", args: ["run", "dev:web"], cwd: root, shell: isWin },
];

const running = new Map(); // service name -> child process
let stopping = false;
let restartingApi = false;

function killTree(child) {
  if (child.exitCode !== null) return;
  // npm on Windows runs through a shell, so kill the whole process tree.
  if (isWin) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGINT");
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of running.values()) killTree(child);
  setTimeout(() => process.exit(code), 500);
}

function start(svc) {
  const child = spawn(svc.cmd, svc.args, { cwd: svc.cwd, shell: svc.shell ?? false, env: process.env });
  const prefix = `${svc.color}[${svc.name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (stopping) return;
    if (svc.name === "api" && restartingApi) return; // intentional restart after a code change
    console.error(`${prefix}stopped (exit ${code}). Stopping the other server too.`);
    stopAll(code ?? 1);
  });
  running.set(svc.name, child);
  return child;
}

for (const svc of services) start(svc);

if (!uvicornReload) {
  const apiSvc = services[0];
  let timer = null;
  watch(path.join(apiDir, "app"), { recursive: true }, (_event, file) => {
    if (!file || !String(file).endsWith(".py") || stopping) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (stopping) return;
      console.log(`\x1b[35m[api]\x1b[0m ${file} changed. Restarting the API only...`);
      restartingApi = true;
      const old = running.get("api");
      const respawn = () => {
        restartingApi = false;
        start(apiSvc);
      };
      if (old && old.exitCode === null) {
        old.once("exit", () => setTimeout(respawn, 300));
        killTree(old);
      } else respawn();
    }, 500);
  });
}

console.log("[dev] API  -> http://localhost:8000/docs" + (uvicornReload ? "" : "  (restarts itself when backend .py files change)"));
console.log("[dev] Web  -> http://localhost:3000");
console.log("[dev] Press Ctrl+C to stop both.");
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
