import { Marked } from 'marked';

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');

// Plain text of inline tokens, without Markdown syntax.
const plain = (tokens) => tokens.map((t) => (t.tokens ? plain(t.tokens) : t.text ?? '')).join('');

export function renderMarkdown(markdown) {
  const seen = new Map();
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const slug = slugify(plain(tokens));
        const n = seen.get(slug) ?? 0;
        seen.set(slug, n + 1);
        const id = n ? `${slug}-${n}` : slug;
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link(href, title, text) {
        const t = title ? ` title="${title}"` : '';
        const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${href}"${t}${ext}>${text}</a>`;
      },
    },
  });
  return marked.parse(markdown);
}
