import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCheck, expectInstalled, importSolution, expect, expectEqual, fail } from '../../src/check-helpers.js';

const usage = { inputTokens: { total: 1, noCache: 1 }, outputTokens: { total: 1, text: 1 } };

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'ai', 7);
  // Load the mock model from the agent's own install so versions always match.
  let MockLanguageModelV4;
  try {
    ({ MockLanguageModelV4 } = await import(pathToFileURL(join(ws, 'node_modules/ai/dist/test/index.js')).href));
  } catch (e) {
    fail('crash', `could not load ai/test from the installed ai@${version}: ${e.message}`);
  }
  const m = await importSolution(ws);
  expect(typeof m.answerWithWeather === 'function', 'answerWithWeather is not exported');
  expect(typeof m.extractContact === 'function', 'extractContact is not exported');

  // 1. Tool calling: step 1 the model asks for the tool, step 2 it answers.
  const calls = [];
  const toolModel = new MockLanguageModelV4({
    doGenerate: async (opts) => {
      calls.push(opts);
      if (calls.length === 1) {
        const tool = (opts.tools || []).find((t) => t.name === 'getWeather');
        if (!tool) fail('wrong_behavior', `no tool named getWeather was given to the model (got: ${(opts.tools || []).map((t) => t.name).join(', ') || 'none'})`);
        return {
          content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'getWeather', input: JSON.stringify({ city: 'Amsterdam' }) }],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage,
          warnings: [],
        };
      }
      const sawResult = JSON.stringify(opts.prompt).includes('21');
      return {
        content: [{ type: 'text', text: sawResult ? 'It is 21°C in Amsterdam.' : 'I never saw the tool result.' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
        warnings: [],
      };
    },
  });
  const answer = await m.answerWithWeather(toolModel, 'What is the weather in Amsterdam?');
  expect(calls.length >= 2, `the model was called ${calls.length} time(s); after the tool call the SDK must call it again for a final answer (multi-step)`);
  expectEqual(answer, 'It is 21°C in Amsterdam.', 'answerWithWeather final text');

  // 2. Structured output.
  const objModel = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com' }) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    }),
  });
  const contact = await m.extractContact(objModel, 'Mail Ada Lovelace at ada@example.com');
  expectEqual(contact, { name: 'Ada Lovelace', email: 'ada@example.com' }, 'extractContact result');
  return `ai@${version}: multi-step tool call and structured output correct`;
});
