import { runCheck, expectInstalled, importSolution, expect, expectEqual, fail } from '../../src/check-helpers.js';

const DOC = `# Hello *World*

Read [the **docs**](https://example.com/docs?a=1&b=2 "Docs home"), the [intro](#hello-world), the [guide](./guide.md) or [mail us](mailto:team@example.com).

## Getting Started

Plain http works too: [old site](http://old.example.com).

## Getting Started

### API v2.0: \`render()\`
`;

function attrs(tag) {
  const out = {};
  for (const [, k, v] of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[k] = v;
  return out;
}

function headings(html) {
  return [...html.matchAll(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g)].map((x) => ({ level: Number(x[1]), ...attrs(x[2] || ''), inner: x[3] }));
}

function links(html) {
  return [...html.matchAll(/<a(\s[^>]*)?>([\s\S]*?)<\/a>/g)].map((x) => ({ ...attrs(x[1] || ''), inner: x[2] }));
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'marked', 18);
  const m = await importSolution(ws);
  expect(typeof m.renderMarkdown === 'function', 'renderMarkdown is not exported');

  const html = await m.renderMarkdown(DOC);
  expect(typeof html === 'string', `renderMarkdown should return a string, got ${typeof html}`);
  if (html.includes('[object Object]') || /href="undefined"|>undefined</.test(html)) {
    fail('wrong_behavior', `rendered HTML contains "[object Object]" or "undefined" (renderer written for the old positional-argument API?): ${html.slice(0, 200).replace(/\s+/g, " ")}`);
  }

  const hs = headings(html);
  expectEqual(hs.map((h) => h.id ?? null), ['hello-world', 'getting-started', 'getting-started-1', 'api-v20-render'], 'heading ids');
  expectEqual(hs.map((h) => h.level), [1, 2, 2, 3], 'heading levels');
  expectEqual(hs[0].inner.trim(), 'Hello <em>World</em>', 'first heading content (inline Markdown must still render)');
  expectEqual(hs[3].inner.trim(), 'API v2.0: <code>render()</code>', 'h3 content');

  const ls = links(html);
  expect(ls.length === 5, `expected 5 links, got ${ls.length}: ${JSON.stringify(ls).slice(0, 300)}`);
  const [docs, intro, guide, mail, old] = ls;
  expectEqual(docs.href, 'https://example.com/docs?a=1&amp;b=2', 'external link href (escaped like marked does)');
  expectEqual(docs.title, 'Docs home', 'external link title');
  expectEqual(docs.inner, 'the <strong>docs</strong>', 'external link text (inline Markdown must still render)');
  expectEqual(docs.target, '_blank', 'external link target');
  expect((docs.rel || '').split(/\s+/).includes('noopener') && (docs.rel || '').split(/\s+/).includes('noreferrer'), `external link rel should be "noopener noreferrer", got ${JSON.stringify(docs.rel)}`);
  expectEqual([old.href, old.target, old.rel], ['http://old.example.com', '_blank', 'noopener noreferrer'], 'http:// link [href, target, rel]');
  for (const [name, l, href] of [['#anchor', intro, '#hello-world'], ['relative', guide, './guide.md'], ['mailto', mail, 'mailto:team@example.com']]) {
    expectEqual(l.href, href, `${name} link href`);
    expect(!('target' in l) && !('rel' in l), `${name} link must not get target/rel: ${JSON.stringify(l)}`);
  }
  expect(html.includes('<p>Plain http works too:'), 'paragraphs are not rendered normally');

  const again = await m.renderMarkdown(DOC);
  expect(again === html, 'rendering the same document twice gives different output (slug counter not reset per call?)');
  const single = await m.renderMarkdown('## Getting Started');
  const sh = headings(single);
  expect(sh.length === 1 && sh[0].id === 'getting-started', `a fresh document should start slugs from scratch, got ${JSON.stringify(single)}`);
  return `marked@${version}: heading ids, external link attributes and normal rendering correct`;
});
