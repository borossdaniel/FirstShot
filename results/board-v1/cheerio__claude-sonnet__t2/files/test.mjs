import assert from 'node:assert/strict';
import { parseProducts } from './solution.mjs';

const html = `
<html>
<body>
  <div class="hero">Not a product, should be ignored</div>

  <div class="product">
    <a class="product-link" href="chair">
      <h3 class="product-title">
        Cozy   Chair &amp; Ottoman
      </h3>
    </a>
    <span class="price">$1,299.00</span>
  </div>

  <div class="product sold-out">
    <a class="product-link" href="../sale/rug">
      <h3 class="product-title">Vintage Rug</h3>
    </a>
    <span class="price"><del>$500.00</del> $349.99</span>
  </div>

  <div class="product">
    <a class="product-link" href="/absolute/lamp">
      <h3 class="product-title">Desk Lamp</h3>
    </a>
    <span class="price">$89</span>
  </div>
</body>
</html>
`;

const pageUrl = 'https://shop.example.com/catalog/furniture/';

const products = parseProducts(html, pageUrl);

assert.equal(products.length, 3, 'should find exactly 3 products');

// Product 1: entity decode + whitespace collapse + comma price
assert.deepEqual(products[0], {
  title: 'Cozy Chair & Ottoman',
  price: 1299,
  url: 'https://shop.example.com/catalog/furniture/chair',
  inStock: true,
});

// Product 2: sold-out class + relative ../ URL + <del> old price ignored
assert.deepEqual(products[1], {
  title: 'Vintage Rug',
  price: 349.99,
  url: 'https://shop.example.com/catalog/sale/rug',
  inStock: false,
});

// Product 3: absolute-path URL + integer price
assert.deepEqual(products[2], {
  title: 'Desk Lamp',
  price: 89,
  url: 'https://shop.example.com/absolute/lamp',
  inStock: true,
});

console.log('All tests passed.');
console.log(JSON.stringify(products, null, 2));
