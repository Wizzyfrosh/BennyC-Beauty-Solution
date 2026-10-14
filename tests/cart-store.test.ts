import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCartStore, type CartItem } from "../src/lib/cart-store";
const item = (): CartItem => ({
  variantId: randomUUID(),
  quantity: 2,
  name: "Sample",
  label: "50 ml",
  priceKobo: 120000,
});
test("a quota/blocked write preserves the latest bag instead of replacing it with stale storage", () => {
  const old = item(),
    next = item();
  const store = createCartStore(() => ({
    getItem: () => JSON.stringify([old]),
    setItem() {
      throw Error("QuotaExceededError");
    },
  }));
  assert.deepEqual(store.snapshot().items, [old]);
  store.write([old, next]);
  assert.deepEqual(store.snapshot().items, [old, next]);
  assert.equal(store.snapshot().persistent, false);
  assert.equal(store.snapshot(), store.snapshot());
  store.write([]);
  assert.deepEqual(store.snapshot().items, []);
});
test("storage read failure preserves an existing bag and fresh blocked storage can use tab memory", () => {
  let blocked = false,
    raw: string | null = null;
  const saved = item();
  const store = createCartStore(() => ({
    getItem() {
      if (blocked) throw Error("SecurityError");
      return raw;
    },
    setItem(_, value) {
      raw = value;
    },
  }));
  store.snapshot();
  store.write([saved]);
  blocked = true;
  assert.deepEqual(store.snapshot().items, [saved]);
  assert.equal(store.snapshot().persistent, false);
  const fresh = createCartStore(() => {
    throw Error("SecurityError");
  });
  assert.equal(fresh.snapshot().persistent, false);
  fresh.write([saved]);
  assert.deepEqual(fresh.snapshot().items, [saved]);
});
test("persisted bags sync changes and reject corrupted, duplicated or oversized data without crashing", () => {
  let raw: string | null = "malformed";
  const saved = item();
  const store = createCartStore(() => ({
    getItem: () => raw,
    setItem(_, value) {
      raw = value;
    },
  }));
  assert.deepEqual(store.snapshot().items, []);
  assert.equal(store.snapshot(), store.snapshot());
  raw = JSON.stringify([saved]);
  assert.deepEqual(store.snapshot().items, [saved]);
  raw = JSON.stringify([saved, saved]);
  assert.deepEqual(store.snapshot().items, []);
  raw = "x".repeat(30000);
  assert.deepEqual(store.snapshot().items, []);
  raw = null;
  assert.deepEqual(store.snapshot().items, []);
  store.write([saved]);
  assert.equal(store.snapshot().persistent, true);
  assert.deepEqual(JSON.parse(raw!), [saved]);
});
test("invalid quantities, privilege fields and basket limits cannot replace a valid bag", () => {
  let raw: string | null = null;
  const saved = item(),
    store = createCartStore(() => ({
      getItem: () => raw,
      setItem(_, value) {
        raw = value;
      },
    }));
  store.write([saved]);
  for (const items of [
    [{ ...saved, quantity: -1 }],
    [{ ...saved, role: "OWNER" }],
    Array.from({ length: 21 }, item),
  ])
    assert.throws(() => store.write(items));
  assert.deepEqual(store.snapshot().items, [saved]);
});
