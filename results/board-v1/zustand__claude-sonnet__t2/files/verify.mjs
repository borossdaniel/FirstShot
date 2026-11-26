import assert from 'node:assert';
import {
  createCartStore,
  selectTotalCents,
  selectItemCount,
  onTotalChange,
} from './solution.mjs';

const store = createCartStore();

assert.deepStrictEqual(store.getState().items, []);
assert.strictEqual(selectTotalCents(store.getState()), 0);
assert.strictEqual(selectItemCount(store.getState()), 0);

const changes = [];
const unsubscribe = onTotalChange(store, (newTotal, prevTotal) => {
  changes.push([prevTotal, newTotal]);
});

const { addItem, setQty, removeItem, clear } = store.getState();

const itemsBefore = store.getState().items;
addItem({ id: 1, name: 'Apple', priceCents: 100 });
assert.strictEqual(store.getState().items, store.getState().items);
assert.notStrictEqual(store.getState().items, itemsBefore, 'items array must be a new reference');
assert.deepStrictEqual(store.getState().items, [{ id: 1, name: 'Apple', priceCents: 100, qty: 1 }]);

addItem({ id: 1, name: 'Apple', priceCents: 100 });
assert.deepStrictEqual(store.getState().items, [{ id: 1, name: 'Apple', priceCents: 100, qty: 2 }]);

addItem({ id: 2, name: 'Banana', priceCents: 50 });
assert.strictEqual(selectTotalCents(store.getState()), 100 * 2 + 50 * 1);
assert.strictEqual(selectItemCount(store.getState()), 3);

const itemsBeforeQty = store.getState().items;
setQty(2, 5);
assert.notStrictEqual(store.getState().items, itemsBeforeQty);
assert.strictEqual(selectItemCount(store.getState()), 2 + 5);

setQty(2, 0);
assert.strictEqual(store.getState().items.find((i) => i.id === 2), undefined);

addItem({ id: 2, name: 'Banana', priceCents: 50 });
removeItem(2);
assert.strictEqual(store.getState().items.find((i) => i.id === 2), undefined);

clear();
assert.deepStrictEqual(store.getState().items, []);
assert.strictEqual(selectTotalCents(store.getState()), 0);

// listener call check: total went 0 -> 100 -> 200 -> 250 -> 300(qty5) -> 250(removeQty0) -> 300(re-add) -> 250(remove) -> 0(clear)
assert.ok(changes.length > 0, 'listener should have fired on total changes');
for (const [prev, next] of changes) {
  assert.notStrictEqual(prev, next, 'listener must only fire when total actually changes');
}

// verify setQty to same value causing no total change does not notify (qty change but same total not easily testable without same priceCents trick)
const changesCountBeforeNoop = changes.length;
addItem({ id: 3, name: 'Cherry', priceCents: 10 });
const countAfterAdd = changes.length;
assert.strictEqual(countAfterAdd, changesCountBeforeNoop + 1);

// immutability check: original item object not mutated
const before = store.getState().items;
const itemRefBefore = before.find((i) => i.id === 3);
setQty(3, 2);
const itemRefAfter = store.getState().items.find((i) => i.id === 3);
assert.notStrictEqual(itemRefBefore, itemRefAfter, 'item object must not be mutated in place');
assert.strictEqual(itemRefBefore.qty, 1, 'original item object must remain unchanged');

unsubscribe();
const countBeforeUnsub = changes.length;
addItem({ id: 4, name: 'Date', priceCents: 1000 });
assert.strictEqual(changes.length, countBeforeUnsub, 'listener must not fire after unsubscribe');

console.log('All checks passed.');
console.log('Total change log:', changes);
