import assert from 'node:assert';
import {
  createCartStore,
  selectTotalCents,
  selectItemCount,
  onTotalChange,
} from './solution.mjs';

const store = createCartStore();

// Initial state
assert.deepStrictEqual(store.getState().items, []);
assert.strictEqual(selectTotalCents(store.getState()), 0);
assert.strictEqual(selectItemCount(store.getState()), 0);

const totalChanges = [];
const unsubscribe = onTotalChange(store, (newTotal, prevTotal) => {
  totalChanges.push([newTotal, prevTotal]);
});

const itemsBefore = store.getState().items;

store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.notStrictEqual(store.getState().items, itemsBefore, 'items array must be a new reference');
assert.strictEqual(store.getState().items.length, 1);
assert.strictEqual(store.getState().items[0].qty, 1);
assert.strictEqual(selectTotalCents(store.getState()), 150);
assert.strictEqual(selectItemCount(store.getState()), 1);

const itemA1 = store.getState().items[0];
store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
assert.strictEqual(store.getState().items.length, 1);
assert.strictEqual(store.getState().items[0].qty, 2);
assert.notStrictEqual(store.getState().items[0], itemA1, 'item object must be replaced, not mutated');
assert.strictEqual(itemA1.qty, 1, 'original item object must remain unmutated');
assert.strictEqual(selectTotalCents(store.getState()), 300);
assert.strictEqual(selectItemCount(store.getState()), 2);

store.getState().addItem({ id: 'b', name: 'Banana', priceCents: 50 });
assert.strictEqual(store.getState().items.length, 2);
assert.strictEqual(selectTotalCents(store.getState()), 350);
assert.strictEqual(selectItemCount(store.getState()), 3);

store.getState().setQty('a', 5);
assert.strictEqual(store.getState().items.find((i) => i.id === 'a').qty, 5);
assert.strictEqual(selectTotalCents(store.getState()), 150 * 5 + 50);

store.getState().setQty('a', 0);
assert.strictEqual(store.getState().items.find((i) => i.id === 'a'), undefined);
assert.strictEqual(selectTotalCents(store.getState()), 50);

store.getState().addItem({ id: 'a', name: 'Apple', priceCents: 150 });
store.getState().removeItem('b');
assert.strictEqual(store.getState().items.length, 1);
assert.strictEqual(store.getState().items[0].id, 'a');

store.getState().clear();
assert.deepStrictEqual(store.getState().items, []);
assert.strictEqual(selectTotalCents(store.getState()), 0);

// onTotalChange should have fired exactly once per actual total change,
// and never with newTotal === prevTotal
for (const [newTotal, prevTotal] of totalChanges) {
  assert.notStrictEqual(newTotal, prevTotal, 'listener must not fire when total is unchanged');
}
assert.ok(totalChanges.length > 0, 'listener should have fired at least once');

// Verify listener does NOT fire when total doesn't change (e.g. setQty to same value causing no net change)
unsubscribe();
const afterUnsubCount = totalChanges.length;
store.getState().addItem({ id: 'c', name: 'Cherry', priceCents: 10 });
assert.strictEqual(totalChanges.length, afterUnsubCount, 'unsubscribe must stop further notifications');

// Test: an action that changes items but not total should not trigger onTotalChange
const store2 = createCartStore();
store2.getState().addItem({ id: 'x', name: 'X', priceCents: 100 });
let fired = false;
onTotalChange(store2, () => {
  fired = true;
});
// removeItem on a non-existent id changes nothing meaningfully, total stays same
store2.getState().removeItem('nonexistent');
assert.strictEqual(fired, false, 'listener should not fire when total unchanged');

// Verify store exposes getState/setState/subscribe (vanilla store shape)
assert.strictEqual(typeof store2.getState, 'function');
assert.strictEqual(typeof store2.setState, 'function');
assert.strictEqual(typeof store2.subscribe, 'function');

console.log('All checks passed.');
