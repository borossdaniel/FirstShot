import { PassThrough } from 'node:stream';
import assert from 'node:assert/strict';
import { createLogger, forRequest } from './logger.mjs';

const stream = new PassThrough();
let buffer = '';
stream.on('data', (chunk) => {
  buffer += chunk.toString();
});

const logger = createLogger({ service: 'checkout-api', destination: stream });

logger.info({ password: 'topsecret', keep: 'me' }, 'top level password');
logger.warn({ user: { password: 'nested-secret', name: 'alice' } }, 'nested password');
logger.error(
  { req: { headers: { authorization: 'Bearer abc123', accept: 'json' } } },
  'auth header',
);

const child = forRequest(logger, 'req-42');
child.info('from child');

await new Promise((resolve) => setTimeout(resolve, 50));

const lines = buffer.trim().split('\n').map((l) => JSON.parse(l));
assert.equal(lines.length, 4);

const [top, nested, auth, childLine] = lines;

// service present, pid/hostname absent
for (const line of lines) {
  assert.equal(line.service, 'checkout-api');
  assert.equal('pid' in line, false, 'pid must be absent');
  assert.equal('hostname' in line, false, 'hostname must be absent');
  assert.equal(typeof line.time, 'string');
  assert.ok(!Number.isNaN(Date.parse(line.time)), 'time must be ISO 8601 parseable');
}

assert.equal(top.level, 'info');
assert.equal(top.password, '[REDACTED]');
assert.equal(top.keep, 'me');

assert.equal(nested.level, 'warn');
assert.equal(nested.user.password, '[REDACTED]');
assert.equal(nested.user.name, 'alice');

assert.equal(auth.level, 'error');
assert.equal(auth.req.headers.authorization, '[REDACTED]');
assert.equal(auth.req.headers.accept, 'json');

assert.equal(childLine.requestId, 'req-42');
assert.equal('requestId' in top, false, 'parent lines must not have requestId');

console.log('All assertions passed.');
console.log(JSON.stringify(lines, null, 2));
