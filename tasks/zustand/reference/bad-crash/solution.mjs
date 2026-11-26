import { createStore } from 'zustand';

export function createCartStore() {
  return createStore()((set) => ({
    items: [],
    addItem: ({ id, name, priceCents }) =>
      set((state) => {
        const existing = state.items.find((i) => i.id === id);
        if (existing) {
          return { items: state.items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)) };
        }
        return { items: [...state.items, { id, name, priceCents, qty: 1 }] };
      }),
    setQty: (id, qty) =>
      set((state) => ({
        items: qty <= 0 ? state.items.filter((i) => i.id !== id) : state.items.map((i) => (i.id === id ? { ...i, qty } : i)),
      })),
    removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
    clear: () => set({ items: [] }),
  }));
}

export const selectTotalCents = (state) => state.items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
export const selectItemCount = (state) => state.items.reduce((sum, i) => sum + i.qty, 0);

export function onTotalChange(store, listener) {
  return store.subscribe((state, prev) => {
    const now = selectTotalCents(state);
    const before = selectTotalCents(prev);
    if (now !== before) listener(now, before);
  });
}
