// Starts the API (port 8000) and the web app (port 3000) together: `npm run dev`.
// Ctrl+C stops both; if either one exits, the other is stopped too.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

const services = [
  { name: "api", color: "\x1b[35m", cmd: venvPython, args: ["-m", "uvicorn", "app.main:app", "--port", "8000", "--reload"], cwd: apiDir },
  { name: "web", color: "\x1b[36m", cmd: "npm", args: ["run", "dev:web"], cwd: root, shell: isWin },
];

const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // npm on Windows runs through a shell, so kill the whole process tree.
    if (isWin) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGINT");
  }
  setTimeout(() => process.exit(code), 500);
}

for (const svc of services) {
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
    console.error(`${prefix}stopped (exit ${code}). Stopping the other server too.`);
    stopAll(code ?? 1);
  });
  children.push(child);
}

console.log("[dev] API  -> http://localhost:8000/docs");
console.log("[dev] Web  -> http://localhost:3000");
console.log("[dev] Press Ctrl+C to stop both.");
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
