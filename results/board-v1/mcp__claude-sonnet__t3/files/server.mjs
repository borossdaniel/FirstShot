import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./solution.mjs";

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
