import { Writable } from "node:stream";
import assert from "node:assert/strict";
import { createLogger, forRequest } from "./logger.mjs";

const lines = [];
const destination = new Writable({
  write(chunk, _enc, cb) {
    chunk
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((l) => lines.push(JSON.parse(l)));
    cb();
  },
});

const logger = createLogger({ service: "my-service", destination });

logger.info({ password: "secret1", other: "keep-me" }, "top-level password");
logger.info({ user: { password: "secret2", name: "bob" } }, "nested password");
logger.info(
  { req: { headers: { authorization: "Bearer abc", "content-type": "json" } } },
  "auth header"
);
logger.warn("plain warn message");

const child = forRequest(logger, "req-123");
child.info("child message");

// flush
logger.flush?.();

setTimeout(() => {
  assert.equal(lines.length, 5, `expected 5 lines, got ${lines.length}`);

  for (const l of lines) {
    assert.equal(l.service, "my-service", "service field missing/wrong");
    assert.equal(l.pid, undefined, "pid should not be present");
    assert.equal(l.hostname, undefined, "hostname should not be present");
    assert.equal(typeof l.level, "string", "level should be a string");
    assert.ok(!isNaN(Date.parse(l.time)), "time should be ISO 8601 parseable");
    assert.ok(l.time.includes("T"), "time should look like ISO 8601");
  }

  const topLevel = lines[0];
  assert.equal(topLevel.level, "info");
  assert.equal(topLevel.password, "[REDACTED]");
  assert.equal(topLevel.other, "keep-me");

  const nested = lines[1];
  assert.equal(nested.user.password, "[REDACTED]");
  assert.equal(nested.user.name, "bob");

  const authLine = lines[2];
  assert.equal(authLine.req.headers.authorization, "[REDACTED]");
  assert.equal(authLine.req.headers["content-type"], "json");

  const warnLine = lines[3];
  assert.equal(warnLine.level, "warn");

  for (let i = 0; i < 4; i++) {
    assert.equal(lines[i].requestId, undefined, "parent lines must not have requestId");
  }

  const childLine = lines[4];
  assert.equal(childLine.requestId, "req-123");

  console.log("ALL TESTS PASSED");
  console.log(JSON.stringify(lines, null, 2));
}, 100);
