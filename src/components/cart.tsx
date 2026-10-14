"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useSyncExternalStore } from "react";
import { z } from "zod";
export type CartItem = {
  variantId: string;
  quantity: number;
  name: string;
  label: string;
  priceKobo: number;
};
const schema = z
  .array(
    z.strictObject({
      variantId: z.uuid(),
      quantity: z.number().int().min(1).max(10000),
      name: z.string().max(160),
      label: z.string().max(250),
      priceKobo: z.number().int().min(1).max(2000000000),
    }),
  )
  .max(20)
  .refine((v) => new Set(v.map((x) => x.variantId)).size === v.length);
const empty: CartItem[] = [];
let cached: CartItem[] = empty,
  serialized: string | null = null;
const listeners = new Set<() => void>();
function snapshot() {
  try {
    const raw = localStorage.getItem("bennyc_cart_v1");
    if (raw !== serialized) {
      serialized = raw;
      const parsed = schema.safeParse(
        raw && raw.length < 30000 ? JSON.parse(raw) : [],
      );
      cached = parsed.success ? parsed.data : empty;
    }
  } catch {
    cached = empty;
  }
  return cached;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
function write(items: CartItem[]) {
  const valid = schema.parse(items);
  cached = valid;
  serialized = JSON.stringify(valid);
  try {
    localStorage.setItem("bennyc_cart_v1", serialized);
  } catch {}
  listeners.forEach((fn) => fn());
}
export function useCart() {
  const items = useSyncExternalStore(subscribe, snapshot, () => empty);
  return {
    items,
    add(item: CartItem) {
      const current = snapshot(),
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
        snapshot().flatMap((x) =>
          x.variantId === id ? (quantity > 0 ? [{ ...x, quantity }] : []) : [x],
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
