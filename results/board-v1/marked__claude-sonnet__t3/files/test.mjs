import { renderMarkdown } from './solution.mjs';
import assert from 'node:assert/strict';

// 1. Heading slug with inline formatting + dedupe
const md1 = `# Hello, World!

## Hello, World!

## Hello, World!

### Café *Déjà Vu* & Co. 100%
`;
const html1 = renderMarkdown(md1);
console.log(html1);
assert.match(html1, /<h1 id="hello-world">Hello, World!<\/h1>/);
assert.match(html1, /<h2 id="hello-world-1">Hello, World!<\/h2>/);
assert.match(html1, /<h2 id="hello-world-2">Hello, World!<\/h2>/);
assert.match(html1, /<h3 id="café-déjà-vu--co-100">Café <em>Déjà Vu<\/em> &amp; Co. 100%<\/h3>/);

// Counting resets per call
const html1b = renderMarkdown('# Hello, World!\n');
assert.match(html1b, /<h1 id="hello-world">Hello, World!<\/h1>/);

// 2. Link behavior
const md2 = `[External](https://example.com "Title") and [Insecure](http://example.com) and [Relative](./page.html) and [Anchor](#section) and [Mail](mailto:a@b.com)`;
const html2 = renderMarkdown(md2);
console.log(html2);
assert.match(html2, /<a href="https:\/\/example\.com" title="Title" target="_blank" rel="noopener noreferrer">External<\/a>/);
assert.match(html2, /<a href="http:\/\/example\.com" target="_blank" rel="noopener noreferrer">Insecure<\/a>/);
assert.match(html2, /<a href="\.\/page\.html">Relative<\/a>/);
assert.match(html2, /<a href="#section">Anchor<\/a>/);
assert.match(html2, /<a href="mailto:a@b\.com">Mail<\/a>/);
assert.doesNotMatch(html2.match(/Relative[^]*?<\/a>/)[0], /target/);
assert.doesNotMatch(html2.match(/Anchor[^]*?<\/a>/)[0], /target/);
assert.doesNotMatch(html2.match(/Mail[^]*?<\/a>/)[0], /target/);

// 3. Compare non-heading / non-link rendering against vanilla marked
import { marked as vanilla } from 'marked';
const md3 = `Some **bold**, *italic*, \`code\`, and a [link](./x) with a > blockquote\n\n> quoted\n\n- a\n- b\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n`;
const got = renderMarkdown(md3);
const expected = vanilla.parse(md3);
assert.equal(got, expected);

console.log('ALL TESTS PASSED');
