import { runCheck, expectInstalled, importSolution, expect, expectEqual, fail } from '../../src/check-helpers.js';
import { Writable } from 'node:stream';

function capture() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { stream, raw: () => chunks.join(''), lines: () => parseLines(chunks.join('')) };
}

function parseLines(raw) {
  return raw
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        fail('wrong_behavior', `log output is not one JSON object per line: ${l.slice(0, 120)}`);
      }
    });
}

const tick = () => new Promise((r) => setTimeout(r, 50));

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'pino', 10);
  const m = await importSolution(ws, 'logger.mjs');
  expect(typeof m.createLogger === 'function', 'createLogger is not exported');
  expect(typeof m.forRequest === 'function', 'forRequest is not exported');

  const out = capture();
  const log = m.createLogger({ service: 'billing', destination: out.stream });
  expect(log && typeof log.info === 'function' && typeof log.child === 'function', 'createLogger did not return a Pino logger');

  log.info(
    {
      user: { id: 7, password: 'hunter2' },
      password: 'top-secret',
      req: { method: 'POST', headers: { authorization: 'Bearer abc123', host: 'api.test' } },
    },
    'login',
  );
  log.debug('debug is below the default level');
  const child = m.forRequest(log, 'req-42');
  expect(child && typeof child.warn === 'function', 'forRequest did not return a logger');
  child.warn({ amountCents: 500 }, 'charged');
  child.info({ password: 'child-secret' }, 'child redaction');
  log.info('after child');
  await tick();

  const raw = out.raw();
  expect(raw.length > 0, 'nothing was written to the destination stream (is it logging to stdout instead?)');
  const lines = out.lines();
  expectEqual(lines.map((l) => l.msg), ['login', 'charged', 'child redaction', 'after child'], 'logged messages (debug must be hidden at the default level)');

  for (const l of lines) {
    expect(l.service === 'billing', `every line needs service "billing", got ${JSON.stringify(l.service)} in ${JSON.stringify(l).slice(0, 200)}`);
    expect(!('pid' in l) && !('hostname' in l), `lines must not include pid or hostname: ${JSON.stringify(l).slice(0, 200)}`);
    expect(typeof l.level === 'string', `level must be a name string like "info", got ${JSON.stringify(l.level)}`);
    expect(typeof l.time === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(l.time) && !Number.isNaN(Date.parse(l.time)), `time must be an ISO 8601 string, got ${JSON.stringify(l.time)}`);
  }
  expectEqual(lines.map((l) => l.level), ['info', 'warn', 'info', 'info'], 'level names');

  for (const secret of ['hunter2', 'top-secret', 'Bearer abc123', 'child-secret']) {
    expect(!raw.includes(secret), `the secret "${secret}" appears in the log output (redaction missing)`);
  }
  const [login, charged, childRedact, after] = lines;
  expectEqual(login.password, '[REDACTED]', 'top-level password');
  expectEqual(login.user, { id: 7, password: '[REDACTED]' }, 'user (only user.password redacted)');
  expectEqual(login.req, { method: 'POST', headers: { authorization: '[REDACTED]', host: 'api.test' } }, 'req (only the authorization header redacted)');

  expectEqual(charged.requestId, 'req-42', 'child line requestId');
  expectEqual(charged.amountCents, 500, 'child line amountCents');
  expectEqual(childRedact.password, '[REDACTED]', 'password logged through the child logger');
  expect(!('requestId' in login) && !('requestId' in after), 'parent logger lines must not carry requestId');

  // An explicit level is honoured.
  const out2 = capture();
  const dbg = m.createLogger({ service: 'jobs', destination: out2.stream, level: 'debug' });
  dbg.debug('visible');
  await tick();
  const dl = out2.lines();
  expect(dl.length === 1 && dl[0].msg === 'visible' && dl[0].level === 'debug' && dl[0].service === 'jobs', `with level "debug" a debug line should be written, got ${out2.raw().slice(0, 200) || 'nothing'}`);

  return `pino@${version}: JSON lines with service, level names, ISO time, redaction and child request ids`;
});
