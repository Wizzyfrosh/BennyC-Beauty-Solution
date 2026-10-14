"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  createCartStore,
  emptyCartSnapshot,
  type CartItem,
} from "@/lib/cart-store";
const store = createCartStore(() => localStorage);
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
function write(items: CartItem[]) {
  store.write(items);
  listeners.forEach((fn) => fn());
}
export function useCart() {
  const state = useSyncExternalStore(
    subscribe,
    store.snapshot,
    () => emptyCartSnapshot,
  );
  return {
    ...state,
    add(item: CartItem) {
      const current = store.snapshot().items,
        old = current.find((x) => x.variantId === item.variantId);
      write(
        old
          ? current.map((x) =>
              x.variantId === item.variantId
                ? {
                    ...item,
                    quantity: Math.min(10000, x.quantity + item.quantity),
                  }
                : x,
            )
          : [...current, item],
      );
    },
    setQuantity(id: string, quantity: number) {
      write(
        store
          .snapshot()
          .items.flatMap((x) =>
            x.variantId === id
              ? quantity > 0
                ? [{ ...x, quantity }]
                : []
              : [x],
          ),
      );
    },
    clear() {
      write([]);
    },
  };
}
export function CartLink() {
  const { items } = useCart();
  const count = items.reduce((s, x) => s + x.quantity, 0);
  return (
    <Link
      className="icon-button cart-link"
      href="/cart"
      aria-label={`Shopping bag, ${count} items`}
    >
      <ShoppingBag size={21} strokeWidth={1.5} />
      {count > 0 && <span className="cart-count">{count}</span>}
    </Link>
  );
}
