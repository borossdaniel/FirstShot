import { Marked, Renderer } from 'marked';

function extractPlainText(tokens) {
  let out = '';
  for (const token of tokens) {
    if (Array.isArray(token.tokens) && token.tokens.length) {
      out += extractPlainText(token.tokens);
    } else if (typeof token.text === 'string') {
      out += token.text;
    }
  }
  return out;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');
}

export function renderMarkdown(markdown) {
  const slugCounts = new Map();
  const marked = new Marked({
    renderer: {
      heading(token) {
        const plainText = extractPlainText(token.tokens);
        const baseSlug = slugify(plainText);
        const count = slugCounts.get(baseSlug) ?? 0;
        slugCounts.set(baseSlug, count + 1);
        const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
        const inner = this.parser.parseInline(token.tokens);
        return `<h${token.depth} id="${slug}">${inner}</h${token.depth}>\n`;
      },
      link(token) {
        const html = Renderer.prototype.link.call(this, token);
        if (!html.startsWith('<a ')) {
          return html;
        }
        if (!/^https?:\/\//i.test(token.href)) {
          return html;
        }
        const closeIdx = html.indexOf('>');
        return (
          html.slice(0, closeIdx) +
          ' target="_blank" rel="noopener noreferrer"' +
          html.slice(closeIdx)
        );
      },
    },
  });

  return marked.parse(markdown);
}
