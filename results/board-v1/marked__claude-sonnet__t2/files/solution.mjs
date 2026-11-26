import { Marked, Renderer } from 'marked';

function extractText(tokens) {
  if (!tokens) return '';
  return tokens
    .map((token) => {
      if (token.type === 'image') return token.text ?? '';
      if (token.tokens) return extractText(token.tokens);
      if (typeof token.text === 'string') return token.text;
      return '';
    })
    .join('');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');
}

export function renderMarkdown(markdown) {
  const slugCounts = new Map();

  const marked = new Marked({
    renderer: {
      heading(token) {
        const html = Renderer.prototype.heading.call(this, token);
        const baseSlug = slugify(extractText(token.tokens));
        const seen = slugCounts.get(baseSlug) ?? 0;
        slugCounts.set(baseSlug, seen + 1);
        const slug = seen === 0 ? baseSlug : `${baseSlug}-${seen}`;
        return html.replace(/^<h([1-6])>/, `<h$1 id="${slug}">`);
      },
      link(token) {
        const html = Renderer.prototype.link.call(this, token);
        if (/^https?:\/\//i.test(token.href)) {
          return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
        }
        return html;
      },
    },
  });

  return marked.parse(markdown);
}
