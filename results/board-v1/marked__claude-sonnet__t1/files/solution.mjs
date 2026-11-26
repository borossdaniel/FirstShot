import { marked, Renderer } from 'marked';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');
}

export function renderMarkdown(markdown) {
  const slugCounts = new Map();

  class CustomRenderer extends Renderer {
    heading(token) {
      const plainText = this.parser.parseInline(token.tokens, this.parser.textRenderer);
      const base = slugify(plainText);
      const count = slugCounts.get(base) ?? 0;
      slugCounts.set(base, count + 1);
      const slug = count === 0 ? base : `${base}-${count}`;
      return `<h${token.depth} id="${slug}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
    }

    link(token) {
      const html = super.link(token);
      if (!/^https?:\/\//i.test(token.href)) return html;
      const closeIdx = html.indexOf('>');
      if (closeIdx === -1) return html;
      return `${html.slice(0, closeIdx)} target="_blank" rel="noopener noreferrer"${html.slice(closeIdx)}`;
    }
  }

  return marked.parse(markdown, { renderer: new CustomRenderer() });
}
