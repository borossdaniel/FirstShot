import { renderMarkdown } from './solution.mjs';

const md = `
# Hello World!

Some [internal link](/foo/bar) and a [relative anchor](#section) and [mail](mailto:a@b.com).

An [external *fancy* link](https://example.com "A Title") and another [plain http](http://example.org).

## Hello World!

### Hello, World??

## Hello World!
`;

console.log(renderMarkdown(md));
console.log('---- second call (counters should reset) ----');
console.log(renderMarkdown('# Hello World!\n\n# Hello World!'));
