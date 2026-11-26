import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./solution.mjs";

const server = createServer();
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

const client = new Client({ name: "test-client", version: "1.0.0" });

await Promise.all([
  client.connect(clientTransport),
  server.connect(serverTransport),
]);

const tools = await client.listTools();
console.log("Tools:", JSON.stringify(tools, null, 2));

const addResult = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
console.log("Add result:", JSON.stringify(addResult, null, 2));

const resources = await client.listResources();
console.log("Resources:", JSON.stringify(resources, null, 2));

const configResult = await client.readResource({ uri: "config://app" });
console.log("Config result:", JSON.stringify(configResult, null, 2));

await client.close();
await server.close();
process.exit(0);
