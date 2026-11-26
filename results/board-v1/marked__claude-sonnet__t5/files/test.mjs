import { renderMarkdown } from './solution.mjs';

const md = `
# Hello, World!

## Hello, World!

### C++ & Friends: 100% Awesome!

This is a [relative link](./foo.html) and an [anchor](#section) and a [mailto](mailto:a@b.com "Email me").

Here is an [external link](https://example.com "Example Title") and another [plain http](http://example.org).

## *Emphasized* \`code\` Heading
`;

console.log(renderMarkdown(md));
console.log('--- fresh call resets counters ---');
console.log(renderMarkdown('# Hello, World!\n\n## Hello, World!'));
