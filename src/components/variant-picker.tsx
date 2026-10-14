"use client";
import { useCart } from "./cart";
import { useState } from "react";
import { formatNaira } from "@/lib/money";
import type { PublicVariant } from "@/features/catalog/types";
export function VariantPicker({
  variants,
  name,
  ordering = false,
}: {
  variants: PublicVariant[];
  name: string;
  ordering?: boolean;
}) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1),
    [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  if (!selected) return <p>No options are available.</p>;
  return (
    <div className="variant-picker">
      <p className="detail-price" aria-live="polite">
        {formatNaira(selected.priceKobo)}
      </p>
      <fieldset>
        <legend>Choose an option</legend>
        <div className="variant-options">
          {variants.map((v) => (
            <label
              key={v.id}
              className={selected.id === v.id ? "selected" : ""}
            >
              <input
                type="radio"
                name="variant"
                value={v.id}
                checked={selected.id === v.id}
                onChange={() => setSelectedId(v.id)}
              />
              <span>{v.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {ordering && (
        <div className="cart-add">
          <label>
            Quantity{" "}
            <input
              type="number"
              min={1}
              max={10000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            className="button"
            disabled={
              !selected.availableQty ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > Math.min(selected.availableQty, 10000)
            }
            onClick={() => {
              try {
                cart.add({
                  variantId: selected.id,
                  quantity,
                  name,
                  label: selected.label,
                  priceKobo: selected.priceKobo,
                });
                setMessage(
                  "Added to your bag. Stock is reserved only at checkout.",
                );
              } catch {
                setMessage("Your bag supports up to 20 different options.");
              }
            }}
          >
            Add to bag
          </button>
          <p role="status">{message}</p>
        </div>
      )}
      <p className="sku-note">SKU: {selected.sku}</p>
      {selected.availableQty !== undefined && (
        <p className="stock-label" aria-live="polite">
          {selected.availableQty > 0
            ? `${selected.availableQty} available`
            : "Currently unavailable"}
        </p>
      )}
    </div>
  );
}
