import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function createServer() {
  const server = new McpServer({ name: 'calc', version: '1.0.0' });
  server.registerTool(
    'add',
    { description: 'Add two numbers', inputSchema: { a: z.number(), b: z.number() } },
    async ({ a, b }) => ({ content: [{ type: 'text', text: a + b }] }),
  );
  server.registerResource(
    'config',
    'config://app',
    { mimeType: 'application/json', description: 'App config' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ name: 'calc' }) }] }),
  );
  return server;
}
