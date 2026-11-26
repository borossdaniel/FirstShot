import * as cheerio from 'cheerio';

const clean = (s) => s.replace(/\s+/g, ' ').trim();

function parsePrice($price) {
  const current = $price.clone();
  current.find('del').remove();
  const text = current.text().replace(/[^0-9.]/g, '');
  return Number.parseFloat(text);
}

export function parseProducts(html, pageUrl) {
  const $ = cheerio.load(html);
  return $('.product')
    .toArray()
    .map((el) => {
      const $el = $(el);
      const href = $el.find('a.product-link').attr('href');
      return {
        title: clean($el.find('.product-title').text()),
        price: parsePrice($el.find('.price')),
        url: href ? new URL(href, pageUrl).href : null,
        inStock: !$el.hasClass('sold-out'),
      };
    });
}
