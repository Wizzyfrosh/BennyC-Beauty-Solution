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
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export const emptyCartSnapshot = { items: [] as CartItem[], persistent: true };
// A storage failure keeps the latest validated bag in this tab. Never reread
// stale disk data over a write that could not be persisted.
export function createCartStore(storage: () => StorageAccess) {
  let state = emptyCartSnapshot,
    serialized: string | null | undefined;
  const key = "bennyc_cart_v1";
  return {
    snapshot() {
      if (!state.persistent) return state;
      let raw: string | null;
      try {
        raw = storage().getItem(key);
      } catch {
        state = { ...state, persistent: false };
        return state;
      }
      if (raw !== serialized) {
        serialized = raw;
        let parsed: unknown = [];
        try {
          if (raw && raw.length < 30000) parsed = JSON.parse(raw);
        } catch {}
        const valid = schema.safeParse(parsed);
        state = { items: valid.success ? valid.data : [], persistent: true };
      }
      return state;
    },
    write(items: CartItem[]) {
      const valid = schema.parse(items);
      const raw = JSON.stringify(valid);
      let persistent = state.persistent;
      if (persistent) {
        try {
          storage().setItem(key, raw);
        } catch {
          persistent = false;
        }
      }
      serialized = raw;
      state = { items: valid, persistent };
    },
  };
}
