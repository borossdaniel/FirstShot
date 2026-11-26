import { load } from 'cheerio';

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function parsePrice($, priceEl) {
  const clone = priceEl.clone();
  clone.find('del').remove();
  const text = clone.text();
  const match = text.match(/[\d,]+(?:\.\d+)?/);
  if (!match) return NaN;
  return parseFloat(match[0].replace(/,/g, ''));
}

export function parseProducts(html, pageUrl) {
  const $ = load(html);

  return $('.product')
    .map((_, el) => {
      const product = $(el);

      const title = cleanText(product.find('.product-title').first().text());

      const price = parsePrice($, product.find('.price').first());

      const href = product.find('a.product-link').first().attr('href');
      const url = href ? new URL(href, pageUrl).toString() : undefined;

      const inStock = !product.hasClass('sold-out');

      return { title, price, url, inStock };
    })
    .get();
}
