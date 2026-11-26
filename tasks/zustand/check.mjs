import { runCheck, expectInstalled, importSolution, expect, expectEqual } from '../../src/check-helpers.js';

const lamp = { id: 'lamp', name: 'Desk lamp', priceCents: 2500 };
const pen = { id: 'pen', name: 'Pen', priceCents: 199 };
const brief = (s) => s.items.map((i) => `${i.id}x${i.qty}`).join(',');

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'zustand', 5);
  const m = await importSolution(ws);
  for (const f of ['createCartStore', 'selectTotalCents', 'selectItemCount', 'onTotalChange']) expect(typeof m[f] === 'function', `${f} is not exported`);

  const store = m.createCartStore();
  expect(store && typeof store === 'object', `createCartStore() should return a vanilla store object, got ${typeof store}${typeof store === 'function' ? ' (a React hook from `create`?)' : ''}`);
  for (const f of ['getState', 'setState', 'subscribe']) expect(typeof store[f] === 'function', `the store has no ${f}() method`);
  expect(typeof store.getInitialState === 'function', 'the store has no getInitialState(): it was not made with Zustand\'s createStore');

  const s0 = store.getState();
  expectEqual(s0.items, [], 'initial items');
  for (const a of ['addItem', 'setQty', 'removeItem', 'clear']) expect(typeof s0[a] === 'function', `the state has no ${a} action`);
  expectEqual(m.selectTotalCents(s0), 0, 'total of an empty cart');

  const seen = [];
  const unsubAll = store.subscribe((state, prev) => seen.push({ state, prev, prevItems: brief(prev), prevFirstQty: prev.items[0]?.qty }));

  store.getState().addItem(lamp);
  store.getState().addItem(pen);
  store.getState().addItem(lamp);
  const s1 = store.getState();
  expectEqual(s1.items.map(({ id, name, priceCents, qty }) => ({ id, name, priceCents, qty })), [
    { ...lamp, qty: 2 },
    { ...pen, qty: 1 },
  ], 'items after addItem(lamp), addItem(pen), addItem(lamp)');
  expectEqual(m.selectTotalCents(s1), 5199, 'selectTotalCents');
  expectEqual(m.selectItemCount(s1), 3, 'selectItemCount');

  expect(seen.length === 3, `subscribe listeners should run once per action (3 actions), ran ${seen.length} times`);
  const last = seen[2];
  expect(last.prev.items !== last.state.items, 'addItem mutated the existing items array instead of creating a new one');
  expect(last.prev.items[0].qty === 1 && last.prevFirstQty === 1, 'addItem changed qty on the existing item object in place (previous state now shows the new quantity)');

  const totals = [];
  const unsub = m.onTotalChange(store, (now, before) => totals.push([now, before]));
  expect(typeof unsub === 'function', 'onTotalChange should return an unsubscribe function');
  store.getState().setQty('pen', 1); // no change in total
  store.setState({ note: 'unrelated update' }); // unrelated state change
  expectEqual(totals, [], 'onTotalChange calls when the total did not change');
  store.getState().setQty('pen', 3);
  expectEqual(totals, [[5597, 5199]], 'onTotalChange after setQty(pen, 3)');
  store.getState().setQty('lamp', 0);
  expectEqual(brief(store.getState()), 'penx3', 'items after setQty(lamp, 0)');
  expectEqual(totals[1], [597, 5597], 'onTotalChange after setQty(lamp, 0)');
  unsub();
  store.getState().removeItem('pen');
  expectEqual(store.getState().items, [], 'items after removeItem(pen)');
  expectEqual(totals.length, 2, 'onTotalChange calls after unsubscribing');

  store.getState().addItem(pen);
  store.getState().clear();
  expectEqual(store.getState().items, [], 'items after clear()');
  expectEqual(m.selectItemCount(store.getState()), 0, 'count after clear()');
  expectEqual(store.getInitialState().items, [], 'getInitialState().items after changes (initial state was mutated)');
  unsubAll();

  const other = m.createCartStore();
  store.getState().addItem(lamp);
  expectEqual(other.getState().items, [], 'a second store from createCartStore() shares state with the first');
  return `zustand@${version}: vanilla store, actions, selectors and change subscription correct`;
});
