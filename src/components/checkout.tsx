"use client";
import { useEffect, useState, useSyncExternalStore, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "./cart";
import { formatNaira } from "@/lib/money";
import { useOperation } from "./admin/request";
type Zone = {
  id: string;
  name: string;
  state: string;
  localGovernmentArea: string;
  areas: string[];
  feeKobo: number;
};
type Quote = {
  quoteVersion: string;
  totalKobo: number;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  lines: { name: string; quantity: number; lineTotalKobo: number }[];
};
async function post(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error?.message ?? "Please retry.");
  return data;
}
export function CartPage() {
  const cart = useCart();
  return (
    <section className="container page-section checkout-shell">
      <p className="eyebrow">Your beauty essentials</p>
      <h1>Shopping bag</h1>
      <p>
        Prices shown here are estimates. Checkout rechecks prices and stock.
      </p>
      {cart.items.length ? (
        <>
          <div className="cart-lines">
            {cart.items.map((item) => (
              <article key={item.variantId} className="cart-row">
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.label}</p>
                  <strong>{formatNaira(item.priceKobo)}</strong>
                </div>
                <label>
                  Quantity
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={item.quantity}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1 && n <= 10000)
                        cart.setQuantity(item.variantId, n);
                    }}
                  />
                </label>
                <button
                  className="text-link"
                  onClick={() => cart.setQuantity(item.variantId, 0)}
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
          <p className="detail-price">
            Estimated subtotal{" "}
            {formatNaira(
              cart.items.reduce((s, x) => s + x.priceKobo * x.quantity, 0),
            )}
          </p>
          <Link className="button" href="/checkout">
            Continue to checkout
          </Link>
        </>
      ) : (
        <div className="notice">
          <p>
            Your bag is empty. <Link href="/shop">Explore the collection</Link>
          </p>
        </div>
      )}
    </section>
  );
}
const intentListeners = new Set<() => void>();
const intentKey = "bennyc_checkout_intent_v1";
let memoryIntent = "";
function intentSnapshot() {
  try {
    return sessionStorage.getItem(intentKey) ?? memoryIntent;
  } catch {
    return memoryIntent;
  }
}
function intentSubscribe(fn: () => void) {
  intentListeners.add(fn);
  return () => {
    intentListeners.delete(fn);
  };
}
function storeIntent(id: string) {
  memoryIntent = id;
  try {
    if (id) sessionStorage.setItem(intentKey, id);
    else sessionStorage.removeItem(intentKey);
  } catch {}
  intentListeners.forEach((fn) => fn());
}
export function CheckoutPage({ enabled }: { enabled: boolean }) {
  const cart = useCart(),
    router = useRouter(),
    op = useOperation();
  const intent = useSyncExternalStore(
    intentSubscribe,
    intentSnapshot,
    () => "",
  );
  const submitting = useRef(false);
  const [zones, setZones] = useState<Zone[]>([]),
    [method, setMethod] = useState("pickup"),
    [zoneId, setZoneId] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [quoting, setQuoting] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" }),
    [address, setAddress] = useState({
      street: "",
      state: "",
      localGovernmentArea: "",
      area: "",
    });
  useEffect(() => {
    if (enabled)
      void fetch("/api/delivery-zones")
        .then(async (r) => {
          if (!r.ok) throw Error();
          setZones(await r.json());
        })
        .catch(() =>
          setError(
            "Delivery areas could not load. Pickup remains available for the demo.",
          ),
        );
  }, [enabled]);
  const zone = zones.find((z) => z.id === zoneId),
    fulfilment =
      method === "pickup"
        ? { method: "pickup" }
        : { method: "delivery", zoneId, address };
  const basket = {
    items: cart.items.map((x) => ({
      variantId: x.variantId,
      quantity: x.quantity,
    })),
    fulfilment,
  };
  function edit() {
    setQuote(null);
    setError("");
  }
  async function review(e: React.FormEvent) {
    e.preventDefault();
    setQuoting(true);
    setError("");
    try {
      await post("/api/guest-session", {});
      setQuote(await post("/api/checkout/quote", basket));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not quote.");
    } finally {
      setQuoting(false);
    }
  }
  async function reserve() {
    if (submitting.current || (!intent && !quote)) return;
    submitting.current = true;
    setQuoting(true);
    setError("");
    try {
      let intentId = intent;
      if (!intentId) {
        const created = await post("/api/checkout/intent", {
          ...basket,
          contact,
          quoteVersion: quote!.quoteVersion,
        });
        intentId = created.intentId;
        storeIntent(intentId);
      }
      const saved = await op.submit("/api/checkout", { intentId });
      if (saved) {
        storeIntent("");
        cart.clear();
        router.push(`/orders/${saved.orderId}`);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reserve. Retry this checkout.",
      );
    } finally {
      submitting.current = false;
      setQuoting(false);
    }
  }
  if (!enabled)
    return (
      <section className="container page-section">
        <h1>Checkout is not open</h1>
        <p>Online payments will open after the shop completes setup.</p>
        <Link href="/cart">Back to your bag</Link>
      </section>
    );
  if (intent)
    return (
      <section className="container page-section checkout-shell">
        <p className="eyebrow">Private demonstration</p>
        <h1>Recover your checkout</h1>
        <p>
          This draft is saved securely on the server. Retry to open the same
          order. No real payment is taken.
        </p>
        <button
          className="button"
          disabled={op.busy || quoting}
          onClick={reserve}
        >
          {op.busy || quoting ? "Recovering…" : "Retry saved checkout"}
        </button>
        {(op.message || error) && <p role="alert">{op.message || error}</p>}
        {op.message && !op.uncertain && !op.busy && !quoting && (
          <p>
            <button
              className="text-link"
              onClick={() => {
                storeIntent("");
                setQuote(null);
              }}
            >
              Review a new checkout
            </button>{" "}
            · Check your saved order before creating another.
          </p>
        )}
      </section>
    );
  if (!cart.items.length)
    return (
      <section className="container page-section">
        <h1>Your bag is empty</h1>
        <Link href="/shop">Explore the collection</Link>
      </section>
    );
  return (
    <section className="container page-section checkout-shell">
      <p className="eyebrow">Private pitch demonstration</p>
      <h1>Guest checkout</h1>
      <p className="notice">
        Demo products and simulated payments only. Use sample contact details.
        No real payment is taken.
      </p>
      <form className="workspace-form" onSubmit={review}>
        <fieldset disabled={op.busy || op.uncertain || quoting}>
          <legend>Your details</legend>
          <div className="form-grid">
            {(["name", "email", "phone"] as const).map((field) => (
              <label key={field}>
                {field === "name"
                  ? "Full name"
                  : field === "email"
                    ? "Email"
                    : "Nigerian phone number"}
                <input
                  required
                  type={
                    field === "email"
                      ? "email"
                      : field === "phone"
                        ? "tel"
                        : "text"
                  }
                  maxLength={
                    field === "name" ? 120 : field === "email" ? 254 : 20
                  }
                  value={contact[field]}
                  onChange={(e) => {
                    setContact({ ...contact, [field]: e.target.value });
                    edit();
                  }}
                  autoComplete={
                    field === "name"
                      ? "name"
                      : field === "phone"
                        ? "tel"
                        : "email"
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Fulfilment
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                edit();
              }}
            >
              <option value="pickup">Pickup</option>
              <option value="delivery" disabled={!zones.length}>
                Local delivery{!zones.length ? " — areas not configured" : ""}
              </option>
            </select>
          </label>
          {method === "delivery" && (
            <>
              <label>
                Approved delivery area
                <select
                  required
                  value={zoneId}
                  onChange={(e) => {
                    const z = zones.find((z) => z.id === e.target.value);
                    setZoneId(e.target.value);
                    setAddress({
                      street: address.street,
                      state: z?.state ?? "",
                      localGovernmentArea: z?.localGovernmentArea ?? "",
                      area: "",
                    });
                    edit();
                  }}
                >
                  <option value="">Choose an area</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} · {formatNaira(z.feeKobo)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Street address
                  <input
                    required
                    maxLength={200}
                    value={address.street}
                    onChange={(e) => {
                      setAddress({ ...address, street: e.target.value });
                      edit();
                    }}
                  />
                </label>
                <label>
                  Neighbourhood
                  <select
                    required
                    value={address.area}
                    onChange={(e) => {
                      setAddress({ ...address, area: e.target.value });
                      edit();
                    }}
                  >
                    <option value="">Choose neighbourhood</option>
                    {zone?.areas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p>
                {zone?.state} · {zone?.localGovernmentArea}
              </p>
            </>
          )}
          <button className="button" type="submit">
            {quoting ? "Checking prices…" : "Review current total"}
          </button>
        </fieldset>
      </form>
      {quote && (
        <div className="workspace-form">
          <h2>Review your order</h2>
          {quote.lines.map((l, i) => (
            <p key={i}>
              {l.quantity} × {l.name}{" "}
              <strong>{formatNaira(l.lineTotalKobo)}</strong>
            </p>
          ))}
          <p>Delivery {formatNaira(quote.deliveryFeeKobo)}</p>
          <p className="detail-price">Total {formatNaira(quote.totalKobo)}</p>
          <p>
            Reserving creates a 15 minute hold. Payment is simulated on the next
            screen.
          </p>
          <button
            className="button"
            disabled={op.busy || quoting}
            onClick={reserve}
          >
            {op.busy
              ? "Reserving…"
              : op.uncertain
                ? "Retry the same reservation"
                : "Reserve demo order"}
          </button>
        </div>
      )}
      {(error || op.message) && (
        <p role="alert" className="notice">
          {error || op.message}
        </p>
      )}
    </section>
  );
}
