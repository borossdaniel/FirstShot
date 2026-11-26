import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["server.mjs"], { stdio: ["pipe", "pipe", "pipe"] });

let output = "";
child.stdout.on("data", (d) => (output += d.toString()));
child.stderr.on("data", (d) => process.stderr.write(d));

const request =
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    },
  }) + "\n";

child.stdin.write(request);

await new Promise((resolve) => setTimeout(resolve, 1000));

console.log("stdout received:", output);
child.kill();
process.exit(0);
