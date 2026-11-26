import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCheck, fail, expect, startMockServer, firstLine } from '../../src/check-helpers.js';

const FACTS = JSON.parse(readFileSync(new URL('../../data/live-facts.json', import.meta.url), 'utf8'));
const CURRENT = FACTS.claudeModels;

runCheck(async (ws) => {
  const file = join(ws, 'ai.mjs');
  if (!existsSync(file)) fail('no_solution', 'ai.mjs was not created');
  if (!existsSync(join(ws, 'node_modules/@anthropic-ai/sdk'))) fail('not_installed', '@anthropic-ai/sdk is not installed');

  // Run the agent's code against a local fake API and see which model it asks for.
  let model = null;
  const mock = await startMockServer((req) => {
    if (req.path.startsWith('/v1/messages')) {
      model = req.body?.model ?? null;
      return { json: { id: 'msg_1', type: 'message', role: 'assistant', model: model || 'x', content: [{ type: 'text', text: 'A short summary.' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } };
    }
    return { status: 404, json: {} };
  });
  process.env.ANTHROPIC_BASE_URL = mock.url;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  try {
    const m = await import(pathToFileURL(file).href);
    expect(typeof m.summarize === 'function', 'summarize is not exported');
    const out = await m.summarize('OneShot checks which model your agent picks.');
    expect(typeof out === 'string' && out.length > 0, 'summarize did not return text');
  } catch (err) {
    if (err?.category) throw err;
    // Fall back to reading the code if it couldn't run against the fake API.
    const src = readFileSync(file, 'utf8');
    model = (src.match(/['"`](claude-[a-z0-9.-]+)['"`]/) || [])[1] ?? null;
    if (!model) fail('crash', `ai.mjs could not run and names no Claude model: ${firstLine(err)}`);
  } finally {
    await mock.close();
  }
  if (!model) fail('wrong_behavior', 'no Claude model was requested');
  if (!CURRENT.includes(model)) {
    fail('outdated_fact', `asked for "${model}"; current models are ${CURRENT.join(', ')}`);
  }
  return `uses ${model}`;
});
