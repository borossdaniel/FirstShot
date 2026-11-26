import assert from 'node:assert';
import {
  createCartStore,
  selectTotalCents,
  selectItemCount,
  onTotalChange,
} from './solution.mjs';

const store = createCartStore();

// basic API shape
assert.equal(typeof store.getState, 'function');
assert.equal(typeof store.setState, 'function');
assert.equal(typeof store.subscribe, 'function');

const totalChanges = [];
const unsubscribe = onTotalChange(store, (newTotal, prevTotal) => {
  totalChanges.push([newTotal, prevTotal]);
});

const itemsBefore = store.getState().items;

store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.deepEqual(store.getState().items, [
  { id: 'a', name: 'Apple', priceCents: 150, qty: 1 },
]);
assert.notEqual(store.getState().items, itemsBefore, 'items array must be a new reference');

const itemsAfterAdd1 = store.getState().items;
store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.equal(store.getState().items[0].qty, 2);
assert.notEqual(store.getState().items, itemsAfterAdd1, 'array replaced');
assert.notEqual(store.getState().items[0], itemsAfterAdd1[0], 'item object replaced');
assert.equal(itemsAfterAdd1[0].qty, 1, 'original item object unchanged (immutability)');

store.getState().addItem({ id: 'b', name: 'Banana', priceCents: 50 });
assert.equal(selectTotalCents(store.getState()), 150 * 2 + 50);
assert.equal(selectItemCount(store.getState()), 3);

store.getState().setQty('b', 5);
assert.equal(store.getState().items.find((i) => i.id === 'b').qty, 5);
assert.equal(selectTotalCents(store.getState()), 150 * 2 + 50 * 5);

store.getState().setQty('b', 0);
assert.equal(store.getState().items.find((i) => i.id === 'b'), undefined);

store.getState().addItem({ id: 'c', name: 'Cherry', priceCents: 10 });
store.getState().removeItem('c');
assert.equal(store.getState().items.find((i) => i.id === 'c'), undefined);

store.getState().clear();
assert.deepEqual(store.getState().items, []);
assert.equal(selectTotalCents(store.getState()), 0);
assert.equal(selectItemCount(store.getState()), 0);

// verify onTotalChange only fired on actual total changes
assert.ok(totalChanges.length > 0, 'listener should have fired at least once');
for (const [newTotal, prevTotal] of totalChanges) {
  assert.notEqual(newTotal, prevTotal, 'listener must only fire when total actually changes');
}

// verify no-op setQty to same qty on nonexistent id / same value doesn't trigger total change spuriously
const changesBeforeNoop = totalChanges.length;
store.getState().addItem({ id: 'x', name: 'X', priceCents: 100 });
const changesAfterAdd = totalChanges.length;
assert.ok(changesAfterAdd > changesBeforeNoop);

// renaming/no total-affecting update should not fire listener
const changesBeforeRename = totalChanges.length;
store.setState((state) => ({
  items: state.items.map((item) =>
    item.id === 'x' ? { ...item, name: 'Renamed X' } : item
  ),
}));
assert.equal(totalChanges.length, changesBeforeRename, 'total-unaffecting update must not fire listener');

unsubscribe();
const changesBeforeUnsub = totalChanges.length;
store.getState().addItem({ id: 'y', name: 'Y', priceCents: 999 });
assert.equal(totalChanges.length, changesBeforeUnsub, 'unsubscribe must stop further notifications');

console.log('All tests passed.');
