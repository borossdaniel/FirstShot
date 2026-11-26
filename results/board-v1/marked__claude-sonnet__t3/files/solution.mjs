import { Marked, Renderer } from 'marked';

function extractPlainText(tokens) {
  let out = '';
  for (const token of tokens) {
    if (Array.isArray(token.tokens) && token.tokens.length) {
      out += extractPlainText(token.tokens);
    } else if (typeof token.text === 'string') {
      out += token.text;
    } else if (token.type === 'br') {
      out += ' ';
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

function insertIntoOpeningTag(html, attribute) {
  const end = html.indexOf('>');
  return html.slice(0, end) + attribute + html.slice(end);
}

let headingSlugCounts;

const marked = new Marked({
  renderer: {
    heading(token) {
      const defaultHtml = Renderer.prototype.heading.call(this, token);
      const base = slugify(extractPlainText(token.tokens));

      let id = base;
      if (headingSlugCounts.has(base)) {
        const next = headingSlugCounts.get(base) + 1;
        headingSlugCounts.set(base, next);
        id = `${base}-${next}`;
      } else {
        headingSlugCounts.set(base, 0);
      }

      return insertIntoOpeningTag(defaultHtml, ` id="${id}"`);
    },
    link(token) {
      const defaultHtml = Renderer.prototype.link.call(this, token);
      const isExternal = /^https?:\/\//i.test(token.href);
      if (!isExternal || !defaultHtml.startsWith('<a ')) {
        return defaultHtml;
      }
      return insertIntoOpeningTag(defaultHtml, ' target="_blank" rel="noopener noreferrer"');
    },
  },
});

export function renderMarkdown(markdown) {
  headingSlugCounts = new Map();
  return marked.parse(markdown);
}
