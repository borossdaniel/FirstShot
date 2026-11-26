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

const toolResult = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
console.log("tool result:", JSON.stringify(toolResult));

const resourceResult = await client.readResource({ uri: "config://app" });
console.log("resource result:", JSON.stringify(resourceResult));

const tools = await client.listTools();
console.log("tools:", JSON.stringify(tools));

const resources = await client.listResources();
console.log("resources:", JSON.stringify(resources));

await client.close();
await server.close();
