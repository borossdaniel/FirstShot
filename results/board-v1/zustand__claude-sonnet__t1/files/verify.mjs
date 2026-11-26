import assert from 'node:assert/strict';
import {
  createCartStore,
  selectTotalCents,
  selectItemCount,
  onTotalChange,
} from './solution.mjs';

const store = createCartStore();

// Initial state
assert.deepEqual(store.getState().items, []);
assert.equal(selectTotalCents(store.getState()), 0);
assert.equal(selectItemCount(store.getState()), 0);

const totalChanges = [];
const unsubscribe = onTotalChange(store, (newTotal, prevTotal) => {
  totalChanges.push([newTotal, prevTotal]);
});

const itemsRefBefore = store.getState().items;

// addItem new item
store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.notEqual(store.getState().items, itemsRefBefore, 'items array must be a new reference');
assert.deepEqual(store.getState().items, [{ id: 'a', name: 'Apple', priceCents: 150, qty: 1 }]);
assert.equal(selectTotalCents(store.getState()), 150);
assert.equal(selectItemCount(store.getState()), 1);

// addItem existing item increments qty, immutably
const itemRefA = store.getState().items[0];
store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.equal(store.getState().items.length, 1);
assert.equal(store.getState().items[0].qty, 2);
assert.notEqual(store.getState().items[0], itemRefA, 'item object must not be mutated in place');
assert.equal(selectTotalCents(store.getState()), 300);
assert.equal(selectItemCount(store.getState()), 2);

// add second item
store.getState().addItem({ id: 'b', name: 'Banana', priceCents: 50 });
assert.equal(store.getState().items.length, 2);
assert.equal(selectTotalCents(store.getState()), 300 + 50);
assert.equal(selectItemCount(store.getState()), 3);

// setQty updates qty
store.getState().setQty('b', 5);
assert.equal(store.getState().items.find((i) => i.id === 'b').qty, 5);
assert.equal(selectTotalCents(store.getState()), 300 + 250);

// setQty 0 removes item
store.getState().setQty('b', 0);
assert.equal(store.getState().items.find((i) => i.id === 'b'), undefined);
assert.equal(store.getState().items.length, 1);

// removeItem
store.getState().addItem({ id: 'c', name: 'Cherry', priceCents: 10 });
store.getState().removeItem('c');
assert.equal(store.getState().items.find((i) => i.id === 'c'), undefined);

// clear
store.getState().clear();
assert.deepEqual(store.getState().items, []);
assert.equal(selectTotalCents(store.getState()), 0);
assert.equal(selectItemCount(store.getState()), 0);

// Check onTotalChange only fired on actual total changes
// Sequence of totals seen: 0 -> 150 -> 300 -> 350 -> 600 -> 350 -> 360 -> 350(removeItem c had total 350->360->350) -> 0
// Let's just check: no two consecutive entries have equal values, and no entry has newTotal === prevTotal
for (const [newTotal, prevTotal] of totalChanges) {
  assert.notEqual(newTotal, prevTotal, 'listener must only fire on actual change');
}
assert.ok(totalChanges.length > 0, 'listener should have fired at least once');

// unsubscribe works
unsubscribe();
const countBefore = totalChanges.length;
store.getState().addItem({ id: 'd', name: 'Date', priceCents: 99 });
assert.equal(totalChanges.length, countBefore, 'listener should not fire after unsubscribe');

// no-op setState (same total) should not trigger listener - test with a fresh subscription
const store2 = createCartStore();
const changes2 = [];
onTotalChange(store2, (n, p) => changes2.push([n, p]));
store2.getState().addItem({ id: 'x', name: 'X', priceCents: 100 });
assert.equal(changes2.length, 1);
// setQty to same value -> total unchanged -> listener should not fire
store2.getState().setQty('x', 1);
assert.equal(changes2.length, 1, 'setting same qty should not change total, listener should not fire again');

// Verify it's a proper vanilla store (no React)
assert.equal(typeof store.getState, 'function');
assert.equal(typeof store.setState, 'function');
assert.equal(typeof store.subscribe, 'function');

console.log('All checks passed.');
console.log('totalChanges:', totalChanges);
