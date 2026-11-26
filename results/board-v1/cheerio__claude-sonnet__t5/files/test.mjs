import assert from 'node:assert/strict';
import { parseProducts } from './solution.mjs';

const html = `
<!doctype html>
<html>
<body>
  <div class="header">Not a product</div>

  <div class="product">
    <a class="product-link" href="chair">
      <h3 class="product-title">
        Cozy   Chair &amp; Ottoman
      </h3>
      <span class="price">$1,299.00</span>
    </a>
  </div>

  <div class="product sold-out">
    <a class="product-link" href="../sale/rug">
      <h3 class="product-title">Vintage Rug</h3>
      <span class="price"><del>$500.00</del> $349.99</span>
    </a>
  </div>

  <div class="product">
    <a class="product-link" href="https://cdn.example.com/lamp">
      <h3 class="product-title">Desk Lamp</h3>
      <span class="price">$49</span>
    </a>
  </div>
</body>
</html>
`;

const pageUrl = 'https://shop.example.com/catalog/furniture/index.html';

const result = parseProducts(html, pageUrl);

console.log(JSON.stringify(result, null, 2));

assert.equal(result.length, 3);

assert.deepEqual(result[0], {
  title: 'Cozy Chair & Ottoman',
  price: 1299,
  url: 'https://shop.example.com/catalog/furniture/chair',
  inStock: true,
});

assert.deepEqual(result[1], {
  title: 'Vintage Rug',
  price: 349.99,
  url: 'https://shop.example.com/catalog/sale/rug',
  inStock: false,
});

assert.deepEqual(result[2], {
  title: 'Desk Lamp',
  price: 49,
  url: 'https://cdn.example.com/lamp',
  inStock: true,
});

console.log('All tests passed.');
