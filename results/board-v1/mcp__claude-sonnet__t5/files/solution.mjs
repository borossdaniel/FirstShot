import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createServer() {
  const server = new McpServer({ name: "calc", version: "1.0.0" });

  server.registerTool(
    "add",
    {
      description: "Add two numbers together",
      inputSchema: {
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }),
  );

  server.registerResource(
    "config",
    "config://app",
    {
      title: "App Config",
      description: "Application configuration",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ name: "calc" }),
        },
      ],
    }),
  );

  return server;
}
