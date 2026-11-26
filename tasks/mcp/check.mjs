import { runCheck, expectInstalled, importSolution, importFromWorkspace, expect, expectEqual, fail } from '../../src/check-helpers.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

runCheck(async (ws) => {
  const version = expectInstalled(ws, '@modelcontextprotocol/sdk', 1);
  const { Client } = await importFromWorkspace(ws, '@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await importFromWorkspace(ws, '@modelcontextprotocol/sdk/inMemory.js');
  const m = await importSolution(ws);
  expect(typeof m.createServer === 'function', 'createServer is not exported');
  const server = m.createServer();
  expect(server && typeof server.connect === 'function', 'createServer() did not return an MCP server with connect()');

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'firstshot-check', version: '1.0.0' });
  await client.connect(clientT);
  try {
    const info = client.getServerVersion();
    expectEqual([info?.name, info?.version], ['calc', '1.0.0'], 'server name and version');

    const { tools } = await client.listTools();
    const add = tools.find((t) => t.name === 'add');
    expect(add, `tool "add" not listed (got: ${tools.map((t) => t.name).join(', ') || 'none'})`);
    const props = add.inputSchema?.properties || {};
    expect(props.a?.type === 'number' && props.b?.type === 'number', `add's input schema should declare numbers a and b, got ${JSON.stringify(add.inputSchema)}`);

    let r;
    try {
      r = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
    } catch (e) {
      fail('wrong_behavior', `callTool add(2, 3) failed: ${String(e.message).split('\n')[0]}`);
    }
    expectEqual(r.content?.[0], { type: 'text', text: '5' }, 'callTool add(2, 3)');

    let bad;
    try {
      bad = await client.callTool({ name: 'add', arguments: { a: 'two', b: 3 } });
    } catch {
      bad = { isError: true };
    }
    expect(bad.isError === true, 'add should reject non-number input via its Zod schema');

    const { resources } = await client.listResources();
    expect(resources.some((x) => x.uri === 'config://app'), `resource config://app not listed (got: ${resources.map((x) => x.uri).join(', ') || 'none'})`);
    const res = await client.readResource({ uri: 'config://app' });
    const c = res.contents?.[0];
    expectEqual([c?.mimeType, JSON.parse(c?.text ?? 'null')], ['application/json', { name: 'calc' }], 'readResource config://app');
  } finally {
    await client.close();
  }
  if (!existsSync(join(ws, 'server.mjs'))) fail('no_solution', 'server.mjs (stdio entry point) was not created');
  return `@modelcontextprotocol/sdk@${version}: tool, validation and resource correct`;
});
