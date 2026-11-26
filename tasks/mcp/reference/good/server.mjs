import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './solution.mjs';
await createServer().connect(new StdioServerTransport());
