import { Writable } from 'node:stream';
import assert from 'node:assert/strict';
import { createLogger, forRequest } from './logger.mjs';

const lines = [];
const destination = new Writable({
  write(chunk, _enc, cb) {
    lines.push(chunk.toString());
    cb();
  },
});

const logger = createLogger({ service: 'checkout-service', destination });

logger.info({ password: 'topsecret', other: 'keep-me' }, 'top-level password');
logger.info({ user: { password: 'nested-secret', name: 'alice' } }, 'one-level-deep password');
logger.info(
  { req: { headers: { authorization: 'Bearer xyz', accept: 'json' } } },
  'auth header',
);
logger.warn('plain warn message');

const child = forRequest(logger, 'req-123');
child.info({ foo: 'bar' }, 'child line with requestId');

logger.flush?.();

await new Promise((resolve) => setTimeout(resolve, 50));

const parsed = lines.join('').trim().split('\n').map((l) => JSON.parse(l));

// 1. top-level password redacted, other fields untouched
assert.equal(parsed[0].password, '[REDACTED]');
assert.equal(parsed[0].other, 'keep-me');
assert.equal(parsed[0].service, 'checkout-service');
assert.equal(parsed[0].level, 'info');
assert.equal(typeof parsed[0].pid, 'undefined');
assert.equal(typeof parsed[0].hostname, 'undefined');
assert.match(parsed[0].time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

// 2. one-level-deep password redacted, sibling field untouched
assert.equal(parsed[1].user.password, '[REDACTED]');
assert.equal(parsed[1].user.name, 'alice');

// 3. req.headers.authorization redacted, sibling header untouched
assert.equal(parsed[2].req.headers.authorization, '[REDACTED]');
assert.equal(parsed[2].req.headers.accept, 'json');

// 4. warn level name
assert.equal(parsed[3].level, 'warn');

// 5. child logger carries requestId, parent lines do not
assert.equal(parsed[4].requestId, 'req-123');
assert.equal(typeof parsed[0].requestId, 'undefined');
assert.equal(typeof parsed[3].requestId, 'undefined');

console.log('ALL CHECKS PASSED');
console.log(JSON.stringify(parsed, null, 2));
