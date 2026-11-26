import { createStore } from 'zustand/vanilla';

export function createCartStore() {
  return createStore((set) => ({
    items: [],

    addItem({ id, name, priceCents }) {
      set((state) => {
        const existing = state.items.find((item) => item.id === id);
        if (existing) {
          return {
            items: state.items.map((item) =>
              item.id === id ? { ...item, qty: item.qty + 1 } : item
            ),
          };
        }
        return {
          items: [...state.items, { id, name, priceCents, qty: 1 }],
        };
      });
    },

    setQty(id, qty) {
      set((state) => {
        if (qty <= 0) {
          return { items: state.items.filter((item) => item.id !== id) };
        }
        return {
          items: state.items.map((item) =>
            item.id === id ? { ...item, qty } : item
          ),
        };
      });
    },

    removeItem(id) {
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      }));
    },

    clear() {
      set({ items: [] });
    },
  }));
}

export function selectTotalCents(state) {
  return state.items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
}

export function selectItemCount(state) {
  return state.items.reduce((sum, item) => sum + item.qty, 0);
}

export function onTotalChange(store, listener) {
  let previousTotal = selectTotalCents(store.getState());
  return store.subscribe((state) => {
    const newTotal = selectTotalCents(state);
    if (newTotal !== previousTotal) {
      const prev = previousTotal;
      previousTotal = newTotal;
      listener(newTotal, prev);
    }
  });
}
