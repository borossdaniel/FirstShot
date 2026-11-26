import { Marked } from 'marked';

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');

export function renderMarkdown(markdown) {
  const seen = new Map();
  const marked = new Marked({
    renderer: {
      heading(text, level) {
        const slug = slugify(text);
        const n = seen.get(slug) ?? 0;
        seen.set(slug, n + 1);
        return `<h${level} id="${n ? `${slug}-${n}` : slug}">${text}</h${level}>\n`;
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
