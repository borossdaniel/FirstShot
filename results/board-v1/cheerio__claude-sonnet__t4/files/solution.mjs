import { load } from 'cheerio';

export function parseProducts(html, pageUrl) {
  const $ = load(html);

  return $('.product')
    .map((_, el) => {
      const $product = $(el);

      const title = $product
        .find('.product-title')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      const $price = $product.find('.price').first().clone();
      $price.find('del').remove();
      const priceMatch = $price.text().match(/[\d,]+(?:\.\d+)?/);
      const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : NaN;

      const href = $product.find('a.product-link').first().attr('href') ?? '';
      const url = new URL(href, pageUrl).toString();

      const inStock = !$product.hasClass('sold-out');

      return { title, price, url, inStock };
    })
    .get();
}
