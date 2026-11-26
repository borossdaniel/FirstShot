import { Marked, Renderer } from 'marked';

const defaultRenderer = new Renderer();

function plainText(tokens) {
  let out = '';
  for (const token of tokens) {
    if (token.tokens && token.tokens.length) {
      out += plainText(token.tokens);
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
        const slug = slugify(plainText(token.tokens));
        const count = slugCounts.get(slug) ?? 0;
        slugCounts.set(slug, count + 1);
        const id = count === 0 ? slug : `${slug}-${count}`;
        return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
      link(token) {
        const html = defaultRenderer.link.call(this, token);
        if (/^https?:\/\//i.test(token.href)) {
          const closeIdx = html.indexOf('>');
          return `${html.slice(0, closeIdx)} target="_blank" rel="noopener noreferrer"${html.slice(closeIdx)}`;
        }
        return html;
      },
    },
  });

  return marked.parse(markdown);
}
