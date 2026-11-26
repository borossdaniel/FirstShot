import { renderMarkdown } from './solution.mjs';
import { marked } from 'marked';
import assert from 'node:assert';

const md = `# Hello *World*

## Hello World

## Hello, World!

[External](https://example.com "A Title") and [Relative](./page.html) and [Anchor](#section) and [Mail](mailto:a@b.com)

Plain [autolink example](http://foo.com).
`;

const html = renderMarkdown(md);
console.log(html);
console.log('---');

// Headings: slug dedup
assert.match(html, /<h1 id="hello-world">Hello <em>World<\/em><\/h1>/);
assert.match(html, /<h2 id="hello-world-1">Hello World<\/h2>/);
assert.match(html, /<h2 id="hello-world-2">Hello, World!<\/h2>/);

// External link gets target/rel
assert.match(html, /<a href="https:\/\/example\.com" title="A Title" target="_blank" rel="noopener noreferrer">External<\/a>/);

// Relative, anchor, mailto links unaffected
assert.match(html, /<a href="\.\/page\.html">Relative<\/a>/);
assert.match(html, /<a href="#section">Anchor<\/a>/);
assert.match(html, /<a href="mailto:a@b\.com">Mail<\/a>/);

assert.ok(!html.includes('relative.html" target'), 'relative should not get target');

// Compare with vanilla marked for unrelated parts (bold/italic rendering etc.)
const plainHtml = marked.parse('Some **bold** and _italic_ text and `code`.');
console.log(renderMarkdown('Some **bold** and _italic_ text and `code`.'));
assert.strictEqual(renderMarkdown('Some **bold** and _italic_ text and `code`.'), plainHtml);

// Fresh counting per call
const html2 = renderMarkdown('## Hello World\n\n## Hello World\n');
assert.match(html2, /<h2 id="hello-world">Hello World<\/h2>/);
assert.match(html2, /<h2 id="hello-world-1">Hello World<\/h2>/);

console.log('All assertions passed.');
