import { runCheck, expectInstalled, importSolution, importFromWorkspace, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

const V1_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const V4_FIXED = '109156be-c4fb-41ea-b1b4-efe1671c5836';
const V7_FIXED = '01941f29-7c00-73e4-a310-744d2167fc5b';

function call(fn, name, ...args) {
  try {
    return fn(...args);
  } catch (e) {
    fail('wrong_behavior', `${name}(${args.map((a) => JSON.stringify(a)).join(', ')}) threw: ${firstLine(e)}`);
  }
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'uuid', 14);
  const lib = await importFromWorkspace(ws, 'uuid');
  const m = await importSolution(ws);
  for (const fn of ['newId', 'newEventId', 'isValidUuid', 'uuidVersion']) expect(typeof m[fn] === 'function', `${fn} is not exported`);

  // newId: v4, unique
  const ids = new Set();
  for (let i = 0; i < 500; i++) {
    const id = await call(m.newId, 'newId');
    expect(typeof id === 'string' && lib.validate(id), `newId() should return a UUID string, got ${JSON.stringify(id)}`);
    expect(lib.version(id) === 4, `newId() should return a version 4 UUID, got version ${lib.version(id)} (${id})`);
    ids.add(id);
  }
  expect(ids.size === 500, 'newId() returned duplicate UUIDs');

  // newEventId: v7 with an explicit timestamp
  const ts = Date.UTC(2026, 10, 26, 12, 34, 56, 789);
  const a = await call(m.newEventId, 'newEventId', ts);
  const b = await call(m.newEventId, 'newEventId', ts);
  for (const id of [a, b]) {
    expect(typeof id === 'string' && lib.validate(id), `newEventId(ts) should return a UUID string, got ${JSON.stringify(id)}`);
    expect(lib.version(id) === 7, `newEventId(ts) should return a version 7 UUID, got version ${lib.version(id)} (${id})`);
  }
  const encoded = parseInt(a.replace(/-/g, '').slice(0, 12), 16);
  expect(encoded === ts, `newEventId(${ts}) should encode that timestamp, but the UUID encodes ${encoded} (${new Date(encoded).toISOString()})`);
  expect(a !== b, 'newEventId(ts) returned the same UUID twice for the same timestamp');

  // newEventId: current time, sortable in creation order
  const t0 = Date.now();
  const seq = [];
  for (let i = 0; i < 200; i++) seq.push(await call(m.newEventId, 'newEventId'));
  const t1 = Date.now();
  for (const id of seq) {
    expect(typeof id === 'string' && lib.validate(id) && lib.version(id) === 7, `newEventId() should return a version 7 UUID, got ${JSON.stringify(id)}`);
  }
  const now = parseInt(seq[0].replace(/-/g, '').slice(0, 12), 16);
  expect(now >= t0 - 1000 && now <= t1 + 1000, `newEventId() should encode the current time, but encodes ${new Date(now).toISOString()}`);
  expect(new Set(seq).size === seq.length, 'newEventId() returned duplicate UUIDs');
  expectEqual([...seq].sort(), seq, 'IDs from newEventId() sorted as strings (should already be in creation order)');

  // isValidUuid
  const validity = [
    [V4_FIXED, true], [V7_FIXED, true], [V1_DNS, true], [V4_FIXED.toUpperCase(), true],
    ['not-a-uuid', false], ['109156be-c4fb-41ea-b1b4-efe1671c583g', false], ['109156bec4fb41eab1b4efe1671c5836', false],
    ['', false], [42, false], [null, false], [undefined, false],
  ];
  for (const [value, want] of validity) {
    expectEqual(await call(m.isValidUuid, 'isValidUuid', value), want, `isValidUuid(${JSON.stringify(value)})`);
  }

  // uuidVersion
  const versions = [[V4_FIXED, 4], [V7_FIXED, 7], [V1_DNS, 1], [a, 7], ['not-a-uuid', null], ['', null], [42, null]];
  for (const [value, want] of versions) {
    expectEqual(await call(m.uuidVersion, 'uuidVersion', value), want, `uuidVersion(${JSON.stringify(value)})`);
  }
  return `uuid@${version}: v4, v7 (timestamp and ordering), validation and version detection correct`;
});
