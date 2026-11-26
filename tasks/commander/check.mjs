import { runCheck, expectInstalled, importSolution, expect, expectEqual } from '../../src/check-helpers.js';

async function runCli(build, args) {
  const program = build();
  const lines = [];
  const errs = [];
  const origLog = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  const wire = (cmd) => {
    cmd.exitOverride();
    cmd.configureOutput({ writeOut: (s) => lines.push(s.trim()), writeErr: (s) => errs.push(s.trim()) });
    for (const c of cmd.commands || []) wire(c);
  };
  wire(program);
  let error = null;
  try {
    await program.parseAsync(['node', 'hello', ...args]);
  } catch (e) {
    error = e;
  } finally {
    console.log = origLog;
  }
  return { lines, errs, error };
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'commander', 15);
  const m = await importSolution(ws);
  expect(typeof m.buildProgram === 'function', 'buildProgram is not exported');

  let r = await runCli(m.buildProgram, ['greet', 'Ada']);
  expect(!r.error, `greet Ada failed: ${r.error?.message}`);
  expectEqual(r.lines, ['Hello, Ada!'], 'greet Ada');

  r = await runCli(m.buildProgram, ['greet', 'Ada', '--times', '2', '--shout']);
  expect(!r.error, `greet --times 2 --shout failed: ${r.error?.message}`);
  expectEqual(r.lines, ['HELLO, ADA!', 'HELLO, ADA!'], 'greet Ada --times 2 --shout');

  for (const bad of ['abc', '0']) {
    r = await runCli(m.buildProgram, ['greet', 'Ada', '--times', bad]);
    expect(r.error && r.error.code === 'commander.invalidArgument', `--times ${bad} should be rejected by Commander as an invalid argument (got ${r.error ? r.error.code : 'no error'}; printed ${JSON.stringify(r.lines)})`);
  }

  r = await runCli(m.buildProgram, ['--version']);
  expect(r.lines.join(' ').includes('1.2.3'), `--version should print 1.2.3, got ${JSON.stringify(r.lines)}`);
  return `commander@${version}: subcommand, options, validation and version correct`;
});
