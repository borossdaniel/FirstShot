import { spawn } from 'node:child_process';

/**
 * Run a command, capture output, enforce a timeout (kills the whole process group).
 * Resolves { code, stdout, stderr, timedOut, durationMs } — never rejects on non-zero exit.
 */
export function run(cmd, args, { cwd, env, timeoutMs = 600_000, input } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...env },
        detached: true, // own process group so we can kill children too
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({ code: 127, stdout, stderr: String(err), timedOut, durationMs: 0 });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => {
      stderr += String(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, timedOut, durationMs: Date.now() - started });
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}
