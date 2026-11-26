import { Writable } from 'node:stream';
import { createLogger, forRequest } from './logger.mjs';

const lines = [];
const destination = new Writable({
  write(chunk, _enc, cb) {
    chunk
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((l) => lines.push(JSON.parse(l)));
    cb();
  },
});

const logger = createLogger({ service: 'my-service', destination });

logger.info(
  {
    password: 'topsecret',
    user: { password: 'alsosecret', name: 'alice' },
    req: { headers: { authorization: 'Bearer xyz', 'x-other': 'keep-me' } },
    other: 'untouched',
  },
  'parent line'
);

const reqLogger = forRequest(logger, 'req-123');
reqLogger.warn('child line');

logger.flush?.();

await new Promise((r) => setTimeout(r, 50));

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

const [parentLine, childLine] = lines;

assert(parentLine.service === 'my-service', 'parent has service field');
assert(parentLine.pid === undefined, 'parent has no pid');
assert(parentLine.hostname === undefined, 'parent has no hostname');
assert(parentLine.level === 'info', 'parent level is string "info"');
assert(
  typeof parentLine.time === 'string' && !Number.isNaN(Date.parse(parentLine.time)),
  'parent time is ISO 8601 string'
);
assert(parentLine.password === '[REDACTED]', 'top-level password redacted');
assert(parentLine.user.password === '[REDACTED]', 'nested user.password redacted');
assert(parentLine.user.name === 'alice', 'user.name untouched');
assert(
  parentLine.req.headers.authorization === '[REDACTED]',
  'req.headers.authorization redacted'
);
assert(parentLine.req.headers['x-other'] === 'keep-me', 'other header untouched');
assert(parentLine.other === 'untouched', 'unrelated field untouched');
assert(parentLine.requestId === undefined, 'parent line has no requestId');

assert(childLine.service === 'my-service', 'child has service field');
assert(childLine.requestId === 'req-123', 'child has requestId');
assert(childLine.level === 'warn', 'child level is string "warn"');
assert(childLine.pid === undefined, 'child has no pid');
assert(childLine.hostname === undefined, 'child has no hostname');

// default level check
const defaultLevelLogger = createLogger({ service: 'svc2', destination });
assert(defaultLevelLogger.level === 'info', 'default level is "info"');

if (process.exitCode === 1) {
  console.error('\nSome checks failed');
  process.exit(1);
} else {
  console.log('\nAll checks passed');
}
