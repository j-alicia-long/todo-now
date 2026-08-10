// Kills any process still listening on the dev port (from zosite.json)
// so `bun run dev` never fails with EADDRINUSE from a stale --hot server.
import config from "../zosite.json";

const port = config.local_port;
const proc = Bun.spawnSync(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"]);
const pids = proc.stdout.toString().trim().split("\n").filter(Boolean);

for (const pid of pids) {
  console.log(`Freeing port ${port}: killing stale process ${pid}`);
  process.kill(Number(pid), "SIGTERM");
}
