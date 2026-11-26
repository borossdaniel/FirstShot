import assert from 'node:assert/strict';
import { parseProducts } from './solution.mjs';

const html = `
<html>
<body>
  <div class="not-a-product">
    <div class="product-title">Should be ignored</div>
  </div>

  <div class="product">
    <a class="product-link" href="chair">
      <h2 class="product-title">
        Comfy   Chair &amp; Ottoman
      </h2>
    </a>
    <span class="price">$1,299.00</span>
  </div>

  <div class="product sold-out">
    <a class="product-link" href="../sale/rug">
      <h2 class="product-title">Vintage Rug</h2>
    </a>
    <span class="price"><del>$500.00</del> $399.99</span>
  </div>

  <div class="product">
    <a class="product-link" href="https://example.com/other/lamp?x=1">
      <h2 class="product-title">Desk Lamp</h2>
    </a>
    <span class="price">$45</span>
  </div>
</body>
</html>
`;

const pageUrl = 'https://shop.example.com/catalog/furniture/page1';
const products = parseProducts(html, pageUrl);

assert.equal(products.length, 3);

assert.deepEqual(products[0], {
  title: 'Comfy Chair & Ottoman',
  price: 1299,
  url: 'https://shop.example.com/catalog/furniture/chair',
  inStock: true,
});

assert.deepEqual(products[1], {
  title: 'Vintage Rug',
  price: 399.99,
  url: 'https://shop.example.com/catalog/sale/rug',
  inStock: false,
});

assert.deepEqual(products[2], {
  title: 'Desk Lamp',
  price: 45,
  url: 'https://example.com/other/lamp?x=1',
  inStock: true,
});

console.log('All tests passed');
console.log(JSON.stringify(products, null, 2));
