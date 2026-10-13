"use client";
import { useState } from "react";
import { formatNaira } from "@/lib/money";
import type { PublicVariant } from "@/features/catalog/types";
export function VariantPicker({ variants }: { variants: PublicVariant[] }) {
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
      <p className="sku-note">SKU: {selected.sku}</p>
    </div>
  );
}
