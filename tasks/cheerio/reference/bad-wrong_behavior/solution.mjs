import { load } from 'cheerio';

export function parseProducts(html, pageUrl) {
  const $ = load(html);
  const products = [];
  $('.product').each((_, el) => {
    const $el = $(el);
    products.push({
      title: $el.find('.product-title').text().replace(/\s+/g, ' ').trim(),
      price: parseFloat($el.find('.price').text().trim().replace('$', '')),
      url: new URL($el.find('a.product-link').attr('href'), pageUrl).href,
      inStock: !$el.hasClass('sold-out'),
    });
  });
  return products;
}
