import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.mjs"],
});

const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("Tools:", JSON.stringify(tools));

const addResult = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
console.log("add(2,3) =>", JSON.stringify(addResult));

const resources = await client.listResources();
console.log("Resources:", JSON.stringify(resources));

const res = await client.readResource({ uri: "config://app" });
console.log("config://app =>", JSON.stringify(res));

await client.close();
process.exit(0);
