import assert from 'node:assert/strict';
import { parseProducts } from './solution.mjs';

const html = `
<html>
<body>
  <div class="not-a-product"><div class="product-title">Ignore me</div></div>

  <div class="product">
    <a class="product-link" href="chair">
      <h2 class="product-title">
        Comfy   &amp; Cozy
        Chair
      </h2>
    </a>
    <span class="price">$999.00 <del>$1,299.00</del></span>
  </div>

  <div class="product sold-out">
    <a class="product-link" href="../sale/rug">
      <h2 class="product-title">Shaggy Rug</h2>
    </a>
    <span class="price"><del>$500.00</del> $250.00</span>
  </div>

  <div class="product">
    <a class="product-link" href="https://other.example.com/lamp">
      <h2 class="product-title">Desk Lamp</h2>
    </a>
    <span class="price">$45.50</span>
  </div>
</body>
</html>
`;

const pageUrl = 'https://shop.example.com/category/furniture/';
const products = parseProducts(html, pageUrl);

assert.equal(products.length, 3);

assert.deepEqual(products[0], {
  title: 'Comfy & Cozy Chair',
  price: 999,
  url: 'https://shop.example.com/category/furniture/chair',
  inStock: true,
});

assert.deepEqual(products[1], {
  title: 'Shaggy Rug',
  price: 250,
  url: 'https://shop.example.com/category/sale/rug',
  inStock: false,
});

assert.deepEqual(products[2], {
  title: 'Desk Lamp',
  price: 45.5,
  url: 'https://other.example.com/lamp',
  inStock: true,
});

console.log('All tests passed.');
console.log(JSON.stringify(products, null, 2));
