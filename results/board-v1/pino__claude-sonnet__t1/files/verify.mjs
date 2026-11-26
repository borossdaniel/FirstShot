import { Writable } from "node:stream";
import { createLogger, forRequest } from "./logger.mjs";

const lines = [];
const destination = new Writable({
  write(chunk, _enc, cb) {
    lines.push(chunk.toString());
    cb();
  },
});

const logger = createLogger({ service: "my-service", destination, level: "debug" });

logger.info({ password: "topsecret", user: { password: "nested-secret", name: "alice" } }, "top-level and nested password");
logger.warn({ req: { headers: { authorization: "Bearer abc123", other: "keepme" } } }, "auth header");
logger.info({ safe: "value", other: 42 }, "no sensitive fields");

const child = forRequest(logger, "req-xyz");
child.info("from child");
logger.info("from parent after child created");

await new Promise((resolve) => setImmediate(resolve));

const parsed = lines.filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("OK:", msg);
  }
}

const [l1, l2, l3, l4, l5] = parsed;

check(l1.service === "my-service", "service field present on line 1");
check(l1.pid === undefined, "no pid field");
check(l1.hostname === undefined, "no hostname field");
check(l1.level === "info", `level is string name, got ${JSON.stringify(l1.level)}`);
check(typeof l1.time === "string" && !Number.isNaN(Date.parse(l1.time)), `time is ISO 8601 string, got ${JSON.stringify(l1.time)}`);
check(l1.time.includes("T") && l1.time.endsWith("Z"), "time looks like ISO format (has T and Z)");
check(l1.password === "[REDACTED]", `top-level password redacted, got ${JSON.stringify(l1.password)}`);
check(l1.user.password === "[REDACTED]", `nested user.password redacted, got ${JSON.stringify(l1.user.password)}`);
check(l1.user.name === "alice", "non-sensitive nested field preserved");

check(l2.level === "warn", "second line level is warn");
check(l2.req.headers.authorization === "[REDACTED]", `req.headers.authorization redacted, got ${JSON.stringify(l2.req.headers.authorization)}`);
check(l2.req.headers.other === "keepme", "other header fields preserved");

check(l3.safe === "value" && l3.other === 42, "non-sensitive fields untouched");

check(l4.requestId === "req-xyz", "child logger line carries requestId");
check(l4.service === "my-service", "child logger line still carries service");

check(l5.requestId === undefined, "parent logger line (after child created) has no requestId");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
