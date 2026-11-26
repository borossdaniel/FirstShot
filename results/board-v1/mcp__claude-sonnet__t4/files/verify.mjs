import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./solution.mjs";

const server = createServer();
const client = new Client({ name: "test-client", version: "1.0.0" });

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([
  server.connect(serverTransport),
  client.connect(clientTransport),
]);

const toolResult = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
console.log("add(2,3) ->", JSON.stringify(toolResult));
if (toolResult.content?.[0]?.text !== "5") {
  throw new Error("add tool did not return '5'");
}

const resourceResult = await client.readResource({ uri: "config://app" });
console.log("config://app ->", JSON.stringify(resourceResult));
const contents = resourceResult.contents?.[0];
if (contents?.mimeType !== "application/json" || contents?.text !== '{"name":"calc"}') {
  throw new Error("config resource mismatch");
}

console.log("OK: all checks passed");
process.exit(0);
