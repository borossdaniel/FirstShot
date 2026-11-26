import * as cheerio from 'cheerio';

function parsePrice($, priceEl) {
  const clone = priceEl.clone();
  clone.find('del').remove();
  const text = clone.text();
  const match = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
}

export function parseProducts(html, pageUrl) {
  const $ = cheerio.load(html);
  const products = [];

  $('.product').each((_, el) => {
    const product = $(el);

    const title = product
      .find('.product-title')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const price = parsePrice($, product.find('.price').first());

    const href = product.find('a.product-link').first().attr('href');
    const url = href ? new URL(href, pageUrl).toString() : null;

    const inStock = !product.hasClass('sold-out');

    products.push({ title, price, url, inStock });
  });

  return products;
}
