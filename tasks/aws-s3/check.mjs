import { createServer } from 'node:http';
import { runCheck, expectInstalled, importSolution, importFromWorkspace, expect, expectEqual, fail } from '../../src/check-helpers.js';

const BUCKET = 'acme-reports';
const PREFIX = 'reports/2026/';
// 1,500 keys under the prefix (more than one ListObjects page) plus keys outside it.
const ALL_KEYS = [
  ...Array.from({ length: 1500 }, (_, i) => `${PREFIX}r-${String(i).padStart(4, '0')}.json`),
  'reports/2025/old.json',
  'z-other/readme.txt',
].sort();

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Undo aws-chunked content encoding (used by the SDK for some streaming uploads).
function decodeBody(raw, headers) {
  if (!String(headers['content-encoding'] || '').includes('aws-chunked') && !String(headers['x-amz-content-sha256'] || '').startsWith('STREAMING-')) return raw;
  let out = '';
  let rest = raw;
  for (;;) {
    const nl = rest.indexOf('\r\n');
    if (nl < 0) break;
    const size = parseInt(rest.slice(0, nl).split(';')[0], 16);
    if (!size) break;
    out += rest.slice(nl + 2, nl + 2 + size);
    rest = rest.slice(nl + 2 + size + 2);
  }
  return out;
}

function listResponse(url) {
  const q = url.searchParams;
  const v2 = q.get('list-type') === '2';
  const prefix = q.get('prefix') || '';
  const max = Math.min(Number(q.get('max-keys') || 1000), 1000);
  let keys = ALL_KEYS.filter((k) => k.startsWith(prefix));
  const after = v2 ? q.get('continuation-token') || q.get('start-after') : q.get('marker');
  if (after) keys = keys.filter((k) => k > after);
  const page = keys.slice(0, max);
  const truncated = keys.length > page.length;
  const last = page[page.length - 1];
  const contents = page.map((k) => `<Contents><Key>${xmlEscape(k)}</Key><LastModified>2026-01-01T00:00:00.000Z</LastModified><ETag>"x"</ETag><Size>2</Size><StorageClass>STANDARD</StorageClass></Contents>`).join('');
  const paging = v2
    ? `<KeyCount>${page.length}</KeyCount>${truncated ? `<NextContinuationToken>${xmlEscape(last)}</NextContinuationToken>` : ''}`
    : `${truncated ? `<NextMarker>${xmlEscape(last)}</NextMarker>` : ''}`;
  return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${BUCKET}</Name><Prefix>${xmlEscape(prefix)}</Prefix><MaxKeys>${max}</MaxKeys><IsTruncated>${truncated}</IsTruncated>${paging}${contents}</ListBucketResult>`;
}

async function startS3Mock() {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (d) => (raw += d));
    req.on('end', () => {
      const url = new URL(req.url, 'http://localhost');
      requests.push({ method: req.method, url, headers: req.headers, body: decodeBody(raw, req.headers) });
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== BUCKET) {
        res.writeHead(404, { 'content-type': 'application/xml' });
        return res.end(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>`);
      }
      if (req.method === 'PUT' && parts.length > 1) {
        res.writeHead(200, { etag: '"0123456789abcdef"' });
        return res.end();
      }
      if (req.method === 'GET' && parts.length === 1) {
        res.writeHead(200, { 'content-type': 'application/xml' });
        return res.end(listResponse(url));
      }
      res.writeHead(400, { 'content-type': 'application/xml' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>NotImplemented</Code><Message>not mocked: ${req.method} ${xmlEscape(req.url)}</Message></Error>`);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, '@aws-sdk/client-s3', 3);
  const { S3Client } = await importFromWorkspace(ws, '@aws-sdk/client-s3');
  const m = await importSolution(ws);
  for (const fn of ['uploadJson', 'listKeys', 'getDownloadUrl']) expect(typeof m[fn] === 'function', `${fn} is not exported`);

  const mock = await startS3Mock();
  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: mock.url,
    forcePathStyle: true,
    credentials: { accessKeyId: 'AKIDTEST', secretAccessKey: 'test-secret' },
    maxAttempts: 1,
  });
  const describe = () => mock.requests.map((r) => `${r.method} ${r.url.pathname}${r.url.search}`).slice(0, 5).join(', ') || 'none';
  try {
    // 1. Upload
    const data = { id: 42, title: 'Q3 report', tags: ['finance'] };
    await m.uploadJson(s3, BUCKET, `${PREFIX}q3.json`, data);
    const put = mock.requests.find((r) => r.method === 'PUT');
    expect(put, `uploadJson made no PUT request (requests: ${describe()})`);
    expectEqual(decodeURIComponent(put.url.pathname), `/${BUCKET}/${PREFIX}q3.json`, 'uploadJson object path');
    expect(String(put.headers['content-type'] || '').startsWith('application/json'), `uploadJson should set the content type to application/json, got ${JSON.stringify(put.headers['content-type'])}`);
    let parsed;
    try { parsed = JSON.parse(put.body); } catch { fail('wrong_behavior', `uploaded body is not JSON: ${JSON.stringify(String(put.body).slice(0, 80))}`); }
    expectEqual(parsed, data, 'uploaded JSON body');

    // 2. List with pagination
    const before = mock.requests.length;
    const keys = await m.listKeys(s3, BUCKET, PREFIX);
    const listReqs = mock.requests.slice(before).filter((r) => r.method === 'GET');
    expect(Array.isArray(keys), `listKeys should return an array, got ${typeof keys}`);
    expect(keys.every((k) => typeof k === 'string'), `listKeys should return key strings, got e.g. ${JSON.stringify(keys[0])}`);
    expect(!keys.some((k) => !k.startsWith(PREFIX)), `listKeys returned keys outside the prefix, e.g. ${keys.find((k) => !k.startsWith(PREFIX))}`);
    const expected = ALL_KEYS.filter((k) => k.startsWith(PREFIX));
    expect(keys.length === expected.length, `listKeys should return all ${expected.length} keys under the prefix (S3 returns at most 1,000 per request, so later pages must be fetched), got ${keys.length} in ${listReqs.length} request(s)`);
    expectEqual([...keys].sort(), expected, 'listKeys keys');

    // 3. Presigned download URL
    const raw = await m.getDownloadUrl(s3, BUCKET, `${PREFIX}q3.json`);
    expect(typeof raw === 'string' || raw instanceof URL, `getDownloadUrl should return a URL string, got ${typeof raw}`);
    let u;
    try { u = new URL(String(raw)); } catch { fail('wrong_behavior', `getDownloadUrl returned something that is not a URL: ${String(raw).slice(0, 100)}`); }
    expectEqual(u.origin, mock.url, 'presigned URL origin (should use the client endpoint)');
    expectEqual(decodeURIComponent(u.pathname), `/${BUCKET}/${PREFIX}q3.json`, 'presigned URL path');
    const q = u.searchParams;
    expect(q.get('X-Amz-Signature'), `URL is not presigned (no X-Amz-Signature): ${u.href.slice(0, 200)}`);
    expectEqual(q.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256', 'X-Amz-Algorithm');
    expect(String(q.get('X-Amz-Credential') || '').startsWith('AKIDTEST/'), `URL should be signed with the client's credentials, got X-Amz-Credential=${q.get('X-Amz-Credential')}`);
    expectEqual(q.get('X-Amz-Expires'), '900', 'X-Amz-Expires (15 minutes)');
    const op = q.get('x-id');
    expect(op === 'GetObject', `URL should be signed for downloading (GetObject), but it is signed for ${op || 'an unknown operation'}`);
  } finally {
    await mock.close();
  }
  return `@aws-sdk/client-s3@${version}: upload, paginated listing and presigned GET URL correct`;
});
