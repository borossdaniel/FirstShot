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
console.log("add(2,3) ->", JSON.stringify(toolResult));
if (toolResult.content[0].text !== "5") throw new Error("add tool failed");

const resourceResult = await client.readResource({ uri: "config://app" });
console.log("config://app ->", JSON.stringify(resourceResult));
if (resourceResult.contents[0].text !== '{"name":"calc"}') throw new Error("resource failed");
if (resourceResult.contents[0].mimeType !== "application/json") throw new Error("mime type failed");

console.log("ALL CHECKS PASSED");
process.exit(0);
