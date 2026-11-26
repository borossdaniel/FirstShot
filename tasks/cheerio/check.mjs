import { runCheck, expectInstalled, importSolution, expect, expectEqual } from '../../src/check-helpers.js';

const PAGE = 'https://shop.example.com/catalog/lighting/page-2';
const HTML = `<!doctype html>
<html><head><title>Lighting – page 2</title></head>
<body>
  <nav><a class="product-link" href="/cart">Cart</a> <span class="price">$0.00</span></nav>
  <ul class="grid">
    <li class="product" data-sku="L-1">
      <a class="product-link" href="/p/arc-floor-lamp"><img src="/img/arc.jpg" alt=""></a>
      <h3 class="product-title">
        Arc   Floor
        Lamp
      </h3>
      <p class="price">$1,299.00</p>
    </li>
    <li class="ad"><h3 class="product-title">Sponsored</h3><span class="price">$5.00</span><a class="product-link" href="https://ads.example.net/x">x</a></li>
    <li class="product sold-out" data-sku="L-2">
      <h3 class="product-title">Tom &amp; Jerry Desk Lamp</h3>
      <p class="price"><del>$39.99</del> $24.50</p>
      <a class="product-link" href="desk-lamp?color=red&amp;size=s">View</a>
    </li>
    <li class="product" data-sku="L-3">
      <h3 class="product-title">Rattan&nbsp;Shade</h3>
      <div class="price"><span class="currency">$</span>89</div>
      <a class="product-link" href="../sale/rattan-shade#reviews">View</a>
    </li>
    <li class="featured product" data-sku="L-4">
      <h3 class="product-title">Brass Wall Light</h3>
      <p class="price"><del>$120.00</del> <ins>$96.75</ins></p>
      <a class="product-link" href="https://partner.example.org/brass?ref=shop">View</a>
    </li>
  </ul>
  <footer><span class="price">$9.99 shipping</span></footer>
</body></html>`;

const EXPECTED = [
  { title: 'Arc Floor Lamp', price: 1299, url: 'https://shop.example.com/p/arc-floor-lamp', inStock: true },
  { title: 'Tom & Jerry Desk Lamp', price: 24.5, url: 'https://shop.example.com/catalog/lighting/desk-lamp?color=red&size=s', inStock: false },
  { title: 'Rattan Shade', price: 89, url: 'https://shop.example.com/catalog/sale/rattan-shade#reviews', inStock: true },
  { title: 'Brass Wall Light', price: 96.75, url: 'https://partner.example.org/brass?ref=shop', inStock: true },
];

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'cheerio', 1);
  const m = await importSolution(ws);
  expect(typeof m.parseProducts === 'function', 'parseProducts is not exported');

  const got = await m.parseProducts(HTML, PAGE);
  expect(Array.isArray(got), `parseProducts should return an array, got ${typeof got}`);
  expect(got.length === EXPECTED.length, `expected ${EXPECTED.length} products (only elements with class "product"), got ${got.length}: ${JSON.stringify(got.map((p) => p && p.title))}`);
  const fields = ['title', 'price', 'url', 'inStock'];
  for (const f of fields) {
    expectEqual(got.map((p) => p[f]), EXPECTED.map((p) => p[f]), `${f} values`);
  }
  for (const p of got) expect(typeof p.price === 'number', `price should be a number, got ${JSON.stringify(p.price)}`);

  // Same parser, different page URL: links must follow the page URL, not a hard-coded host.
  const other = await m.parseProducts(HTML, 'http://localhost:8080/shop/');
  expectEqual(other.map((p) => p.url), [
    'http://localhost:8080/p/arc-floor-lamp',
    'http://localhost:8080/shop/desk-lamp?color=red&size=s',
    'http://localhost:8080/sale/rattan-shade#reviews',
    'https://partner.example.org/brass?ref=shop',
  ], 'urls resolved against http://localhost:8080/shop/');

  expectEqual(await m.parseProducts('<html><body><p>No products today</p></body></html>', PAGE), [], 'page without products');
  return `cheerio@${version}: products, prices, absolute links and stock status correct`;
});
