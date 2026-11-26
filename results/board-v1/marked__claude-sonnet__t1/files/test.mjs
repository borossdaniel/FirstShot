import { renderMarkdown } from './solution.mjs';

const md = `# Hello, World!

## Hello, World!

Some **bold** and \`code\` in a [link](http://example.com "A Title").

### Hello, World!

[Relative link](/foo/bar)

[Anchor link](#hello-world)

[Mail link](mailto:test@example.com)

[Secure link](https://example.com/page)

#### \`Code\` **Bold** _Italic_ Heading!
`;

const html = renderMarkdown(md);
console.log(html);
console.log('--- run twice to confirm counters reset ---');
console.log(renderMarkdown('# Repeat\n\n## Repeat\n').includes('id="repeat"'));
