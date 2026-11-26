import { load } from 'cheerio';

export function parseProducts(html, pageUrl) {
  const $ = load(html);
  const products = [];

  $('.product').each((_, el) => {
    const $el = $(el);

    const title = $el
      .find('.product-title')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const $price = $el.find('.price').first().clone();
    $price.find('del').remove();
    const priceText = $price.text().replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText);

    const href = $el.find('a.product-link').first().attr('href');
    const url = new URL(href, pageUrl).href;

    const inStock = !$el.hasClass('sold-out');

    products.push({ title, price, url, inStock });
  });

  return products;
}
