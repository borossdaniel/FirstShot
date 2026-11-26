import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "test-client", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["server.mjs"],
});

await client.connect(transport);

const tools = await client.listTools();
console.log("tools ->", JSON.stringify(tools.tools.map((t) => t.name)));

const toolResult = await client.callTool({ name: "add", arguments: { a: 10, b: 7 } });
console.log("add(10,7) ->", JSON.stringify(toolResult));

const resources = await client.listResources();
console.log("resources ->", JSON.stringify(resources.resources.map((r) => r.uri)));

const resourceResult = await client.readResource({ uri: "config://app" });
console.log("config://app ->", JSON.stringify(resourceResult));

await client.close();
console.log("OK: stdio server verified");
process.exit(0);
