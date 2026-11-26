import assert from 'node:assert/strict';
import { parseProducts } from './solution.mjs';

const html = `
<html><body>
  <div class="not-a-product"><div class="product-title">Ignore Me</div></div>

  <div class="product">
    <a class="product-link" href="chair">
      <div class="product-title">  Comfy   Chair &amp; Ottoman </div>
    </a>
    <div class="price">$1,299.00</div>
  </div>

  <div class="product sold-out">
    <a class="product-link" href="../sale/rug">
      <div class="product-title">Vintage Rug</div>
    </a>
    <div class="price"><del>$500.00</del> $349.99</div>
  </div>

  <div class="product">
    <a class="product-link" href="https://cdn.example.com/lamp">
      <div class="product-title">Desk Lamp</div>
    </a>
    <div class="price">$49</div>
  </div>
</body></html>
`;

const pageUrl = 'https://shop.example.com/catalog/furniture/index.html';

const result = parseProducts(html, pageUrl);

assert.equal(result.length, 3);

assert.deepEqual(result[0], {
  title: 'Comfy Chair & Ottoman',
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
console.log(JSON.stringify(result, null, 2));
