// GET /api/scan?repo=owner/name — run `oneshot-agent check` on a public GitHub repo, so
// people can try OneShot on the website without installing anything.
//
// Streams the repo's default branch as a tarball (codeload.github.com), keeps only the
// files the check reads (code, package files, workflows, Dockerfiles), runs the same
// checkProject() the CLI uses, and deletes the files again. Nothing is stored; results are
// cached at the edge for an hour per repo.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createGunzip } from 'node:zlib';

const MAX_GZ = 120 * 1024 * 1024; // compressed download cap (next.js is ~50 MB)
const TIME_MS = 40_000;
const MAX_FILE = 512 * 1024;
const MAX_FILES = 5000;
const SKIP = /(^|\/)(node_modules|\.git|dist|build|\.next|vendor|venv|\.venv|__pycache__|coverage)\//;
const WANT = (p) =>
  /\.(m?[jt]sx?|cjs|py|json|ya?ml|toml|go|rb|java|kt|cs|php|rs|swift|txt)$/.test(p) ||
  /(^|\/)Dockerfile[^/]*$/.test(p) ||
  /(^|\/)\.env(\.[\w-]+)?$/.test(p);

/** Parse a repo from "owner/name" or any github.com URL. */
export function parseRepo(input) {
  const s = String(input || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(?:\/(?:tree|blob)\/.*)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Streaming tar reader: keeps only the wanted files, so memory stays small for big repos. */
export class TarSink {
  constructor(dir) {
    Object.assign(this, { dir, buf: Buffer.alloc(0), need: 512, state: 'head', entry: null, longName: null, kept: 0, done: false });
  }
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (!this.done && this.buf.length >= this.need) {
      const block = this.buf.subarray(0, this.need);
      this.buf = this.buf.subarray(this.need);
      if (this.state === 'head') this.head(block);
      else this.body(block);
    }
  }
  head(h) {
    if (h.every((b) => b === 0)) return; // padding or end-of-archive blocks
    const str = (a, b) => h.toString('utf8', a, b).replace(/\0.*$/s, '');
    const size = parseInt(str(124, 136).trim() || '0', 8) || 0;
    const type = String.fromCharCode(h[156] || 48);
    const prefix = str(345, 500);
    const name = this.longName ?? (prefix ? `${prefix}/${str(0, 100)}` : str(0, 100));
    this.longName = null;
    this.entry = { name, size, type };
    if (size === 0) return;
    this.state = 'body';
    this.need = Math.ceil(size / 512) * 512;
  }
  body(block) {
    const { name, size, type } = this.entry;
    const data = block.subarray(0, size);
    this.state = 'head';
    this.need = 512;
    if (type === 'x') {
      const m = data.toString('utf8').match(/\d+ path=([^\n]*)\n/);
      if (m) this.longName = m[1];
      return;
    }
    if (type === 'L') {
      this.longName = data.toString('utf8').replace(/\0.*$/s, '');
      return;
    }
    if (type !== '0' && type !== '\0' && type !== '7') return;
    const rel = name.split('/').slice(1).join('/');
    if (!rel || rel.split('/').includes('..') || SKIP.test(rel) || !WANT(rel) || size > MAX_FILE) return;
    if (/(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(rel)) return;
    const p = join(this.dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data);
    if (++this.kept >= MAX_FILES) this.done = true;
  }
}

const tooBig = () => Object.assign(new Error('This repo is too big to check in the browser. Run npx oneshot-agent check inside it instead.'), { status: 413 });

async function fetchInto(repo, dir) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIME_MS);
  try {
    const r = await fetch(`https://codeload.github.com/${repo}/tar.gz/HEAD`, { signal: ctl.signal });
    if (r.status === 404) throw Object.assign(new Error('Repo not found. Only public GitHub repos can be checked here.'), { status: 404 });
    if (!r.ok) throw Object.assign(new Error(`GitHub answered ${r.status}. Try again in a minute.`), { status: 502 });
    if (Number(r.headers.get('content-length')) > MAX_GZ) throw tooBig();
    const sink = new TarSink(dir);
    const gunzip = createGunzip();
    gunzip.on('data', (c) => sink.push(c));
    const ended = new Promise((ok, bad) => {
      gunzip.on('end', ok);
      gunzip.on('error', bad);
    });
    ended.catch(() => {});
    let n = 0;
    for await (const c of r.body) {
      n += c.length;
      if (n > MAX_GZ) throw tooBig();
      if (!gunzip.write(c)) await new Promise((ok) => gunzip.once('drain', ok));
      if (sink.done) break;
    }
    if (sink.done) gunzip.destroy();
    else {
      gunzip.end();
      await ended;
    }
    return { files: sink.kept, partial: sink.done };
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') throw tooBig();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  const url = new URL(req.url, 'http://x');
  const repo = parseRepo(url.searchParams.get('repo'));
  if (!repo) {
    res.status(400).send(JSON.stringify({ error: 'Paste a public GitHub repo, like vercel/next.js or https://github.com/owner/name.' }));
    return;
  }
  process.env.ONESHOT_FACTS_URL ||= 'https://www.oneshotagent.dev/facts.json';
  process.env.ONESHOT_FACTS_CACHE ||= join(tmpdir(), 'oneshot-facts.json');
  const dir = mkdtempSync(join(tmpdir(), 'scan-'));
  try {
    const { files, partial } = await fetchInto(repo, dir);
    const { checkProject } = await import('./_lib/src/advisor.js');
    const rep = await checkProject(dir);
    const facts = (rep.facts || []).map(({ kind, level, file, line, found, fix, message, retires }) => ({ kind, level, file, line, found, fix, message, retires }));
    const outdated = (rep.outdated || []).map(({ name, range, latest, behind, system }) => ({ name, range, latest, behind, system }));
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(JSON.stringify({ repo, files, partial, checkedPackages: (rep.checked || []).length, facts, outdated }));
  } catch (err) {
    res.setHeader('cache-control', 'no-store');
    res.status(err.status || 500).send(JSON.stringify({ error: err.status ? err.message : 'Something went wrong checking this repo. Try again, or run npx oneshot-agent check locally.' }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
