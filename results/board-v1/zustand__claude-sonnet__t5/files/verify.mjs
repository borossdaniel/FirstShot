import assert from 'node:assert/strict';
import { createCartStore, selectTotalCents, selectItemCount, onTotalChange } from './solution.mjs';

const store = createCartStore();

// Immutability check
const initialItems = store.getState().items;
store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.notEqual(store.getState().items, initialItems, 'items array should be a new reference');
assert.deepEqual(initialItems, [], 'original items array should be untouched');

store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.equal(store.getState().items.length, 1);
assert.equal(store.getState().items[0].qty, 2);

store.getState().addItem({ id: 'b', name: 'Banana', priceCents: 50 });
assert.equal(store.getState().items.length, 2);

assert.equal(selectTotalCents(store.getState()), 150 * 2 + 50 * 1);
assert.equal(selectItemCount(store.getState()), 3);

// setQty
const beforeSetQty = store.getState().items;
store.getState().setQty('a', 5);
assert.notEqual(store.getState().items, beforeSetQty);
assert.equal(store.getState().items.find((i) => i.id === 'a').qty, 5);

// setQty 0 removes
store.getState().setQty('b', 0);
assert.equal(store.getState().items.find((i) => i.id === 'b'), undefined);

// removeItem
store.getState().addItem({ id: 'c', name: 'Cherry', priceCents: 10 });
store.getState().removeItem('a');
assert.equal(store.getState().items.find((i) => i.id === 'a'), undefined);
assert.equal(store.getState().items.find((i) => i.id === 'c'), undefined ? undefined : store.getState().items.find((i) => i.id === 'c'));

// clear
store.getState().clear();
assert.deepEqual(store.getState().items, []);

// onTotalChange
const changes = [];
const unsub = onTotalChange(store, (newTotal, prevTotal) => {
  changes.push([newTotal, prevTotal]);
});

store.getState().addItem({ id: 'x', name: 'X', priceCents: 100 });
assert.deepEqual(changes, [[100, 0]]);

store.getState().addItem({ id: 'y', name: 'Y', priceCents: 0 }); // total unchanged if priceCents 0, but item count changes
// priceCents 0 means total doesn't change -> listener should NOT fire
assert.deepEqual(changes, [[100, 0]], 'listener should not fire when total unchanged');

store.getState().setQty('x', 3);
assert.deepEqual(changes, [[100, 0], [300, 100]]);

unsub();
store.getState().addItem({ id: 'z', name: 'Z', priceCents: 999 });
assert.deepEqual(changes, [[100, 0], [300, 100]], 'listener should not fire after unsubscribe');

console.log('All checks passed.');
