"use client";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";
import { nairaToKobo, useOperation } from "./request";
type Variant = {
  id?: string;
  sku: string;
  optionValues: Record<string, string>;
  priceKobo: number;
  lowStockThreshold: number;
  active: boolean;
};
type Product = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  description: string;
  categoryId: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  expiryRequired: boolean;
  isDemo: boolean;
  variants: Variant[];
};
type Catalogue = {
  products: Product[];
  categories: { id: string; name: string }[];
  limit: number;
};
export function ProductsWorkspace() {
  const [data, setData] = useState<Catalogue | null>(null),
    [error, setError] = useState(""),
    [editor, setEditor] = useState<Product | null | false>(false);
  async function load() {
    try {
      const r = await fetch("/api/admin/products");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message);
      setData(d);
    } catch {
      setError("Products could not load. Please retry.");
    }
  }
  useEffect(() => {
    void fetch("/api/admin/products")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error();
        setData(d);
      })
      .catch(() => setError("Products could not load. Please retry."));
  }, []);
  if (error)
    return (
      <div className="notice" role="alert">
        {error}
        <button
          onClick={() => {
            setError("");
            void load();
          }}
          className="outline-button"
        >
          Retry
        </button>
      </div>
    );
  if (!data) return <p role="status">Loading products…</p>;
  if (editor !== false)
    return (
      <ProductEditor
        product={editor}
        categories={data.categories}
        done={() => {
          setEditor(false);
          void load();
        }}
      />
    );
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Catalogue management</p>
          <h1>Products</h1>
          <p>Create, edit, publish or archive your catalogue.</p>
        </div>
        <button className="button" onClick={() => setEditor(null)}>
          Add product
        </button>
      </div>
      <p className="form-help">
        Showing up to {data.limit} most recently edited products. Archiving
        preserves stock and sales history.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th>Options</th>
              <th>Starting price</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <small>
                    {p.brand}
                    {p.isDemo ? " · Sample" : ""}
                  </small>
                </td>
                <td>
                  <span className="status-pill">{p.status.toLowerCase()}</span>
                </td>
                <td>{p.variants.filter((v) => v.active).length} active</td>
                <td>
                  {p.variants.length
                    ? formatNaira(
                        Math.min(
                          ...(p.variants.some((v) => v.active)
                            ? p.variants.filter((v) => v.active)
                            : p.variants
                          ).map((v) => v.priceKobo),
                        ),
                      )
                    : "—"}
                </td>
                <td>
                  <button
                    onClick={() => setEditor(p)}
                    className="outline-button"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.products.length && (
          <p className="table-empty">
            No products yet. Add your first product.
          </p>
        )}
      </div>
    </>
  );
}
function ProductEditor({
  product,
  categories,
  done,
}: {
  product: Product | null;
  categories: Catalogue["categories"];
  done: () => void;
}) {
  const operation = useOperation();
  const [localError, setLocalError] = useState("");
  const [savedId, setSavedId] = useState(product?.id ?? "");
  const [variants, setVariants] = useState(
    product?.variants.map((v) => ({
      ...v,
      amount: (v.priceKobo / 100).toFixed(2),
      options: Object.entries(v.optionValues)
        .map(([k, val]) => `${k}: ${val}`)
        .join("\n"),
    })) ?? [
      {
        id: undefined,
        sku: "",
        optionValues: {},
        priceKobo: 0,
        lowStockThreshold: 0,
        active: true,
        amount: "",
        options: "volume: 50 ml",
      },
    ],
  );
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    const form = new FormData(event.currentTarget);
    try {
      const rows = variants.map((v) => {
        const options: Record<string, string> = {};
        for (const line of v.options.split("\n").filter(Boolean)) {
          const at = line.indexOf(":");
          if (at < 1)
            throw new Error(
              "Write each option as name: value, such as volume: 50 ml.",
            );
          options[line.slice(0, at).trim()] = line.slice(at + 1).trim();
        }
        return {
          ...(v.id ? { id: v.id } : {}),
          sku: v.sku,
          optionValues: options,
          priceKobo: nairaToKobo(v.amount),
          lowStockThreshold: v.lowStockThreshold,
          active: v.active,
        };
      });
      const payload = {
        name: form.get("name"),
        slug: form.get("slug"),
        brand: form.get("brand"),
        description: form.get("description"),
        categoryId: form.get("categoryId"),
        status: form.get("status"),
        expiryRequired: form.has("expiryRequired"),
        variants: rows,
      };
      const result = await operation.submit(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        payload,
        product ? "PATCH" : "POST",
      );
      if (result) {
        setSavedId(result.id);
        done();
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Check the form.");
    }
  }
  function update(index: number, values: Partial<(typeof variants)[number]>) {
    setVariants((old) =>
      old.map((v, i) => (i === index ? { ...v, ...values } : v)),
    );
  }
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Owner catalogue tools</p>
          <h1>{product ? "Edit product" : "New product"}</h1>
        </div>
        <button
          className="outline-button"
          disabled={operation.busy || operation.uncertain}
          onClick={done}
        >
          Back to products
        </button>
      </div>
      <form className="workspace-form" onSubmit={save}>
        <fieldset disabled={operation.busy || operation.uncertain}>
          <div className="form-grid">
            <label>
              Product name
              <input
                name="name"
                required
                maxLength={160}
                defaultValue={product?.name}
              />
            </label>
            <label>
              Product address
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="body-lotion"
                defaultValue={product?.slug}
              />
            </label>
            <label>
              Brand
              <input
                name="brand"
                required
                maxLength={80}
                defaultValue={product?.brand}
              />
            </label>
            <label>
              Category
              <select
                name="categoryId"
                required
                defaultValue={product?.categoryId ?? categories[0]?.id}
              >
                {categories.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={product?.status ?? "DRAFT"}>
                <option>DRAFT</option>
                <option>PUBLISHED</option>
                <option>ARCHIVED</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                name="expiryRequired"
                type="checkbox"
                defaultChecked={product?.expiryRequired ?? true}
              />{" "}
              Expiry date required for saleable stock
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={5000}
              rows={4}
              defaultValue={product?.description}
            />
          </label>
          <h2>Sizes, shades & prices</h2>
          {variants.map((v, i) => (
            <div className="variant-editor" key={v.id ?? i}>
              <div className="form-grid">
                <label>
                  SKU
                  <input
                    required
                    maxLength={80}
                    value={v.sku}
                    onChange={(e) => update(i, { sku: e.target.value })}
                  />
                </label>
                <label>
                  Price (₦)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={v.amount}
                    onChange={(e) => update(i, { amount: e.target.value })}
                  />
                </label>
                <label>
                  Low-stock alert threshold
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    value={v.lowStockThreshold}
                    onChange={(e) =>
                      update(i, { lowStockThreshold: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Size, shade or volume (one per line)
                  <textarea
                    value={v.options}
                    onChange={(e) => update(i, { options: e.target.value })}
                    rows={2}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) => update(i, { active: e.target.checked })}
                  />{" "}
                  Active option
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="outline-button"
            disabled={variants.length >= 40}
            onClick={() =>
              setVariants([
                ...variants,
                {
                  id: undefined,
                  sku: "",
                  optionValues: {},
                  priceKobo: 0,
                  lowStockThreshold: 0,
                  active: true,
                  amount: "",
                  options: "",
                },
              ])
            }
          >
            Add option
          </button>
        </fieldset>
        {(operation.message || localError) && (
          <p className="form-error" role="alert">
            {operation.message || localError}
          </p>
        )}
        <button className="button" disabled={operation.busy} type="submit">
          {operation.busy
            ? "Saving…"
            : operation.uncertain
              ? "Retry same save"
              : "Save product"}
        </button>
      </form>
      {savedId && <ImageUpload productId={savedId} />}
    </>
  );
}
function ImageUpload({ productId }: { productId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <form
      className="workspace-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const form = new FormData(e.currentTarget);
        form.set("productId", productId);
        try {
          const r = await fetch("/api/admin/product-images", {
            method: "POST",
            headers: { "Idempotency-Key": key },
            body: form,
          });
          const d = await r.json();
          setMessage(
            r.ok ? "Image uploaded." : (d.error?.message ?? "Upload failed."),
          );
          if (r.ok) setKey(crypto.randomUUID());
        } catch {
          setMessage(
            "Upload could not be confirmed. Retry with the same file.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Product photograph</h2>
      <p className="form-help">
        JPEG, PNG or WebP · Up to 5 MB. Uploads require the owner’s image
        service configuration.
      </p>
      <label>
        Image
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={busy}
        />
      </label>
      <label>
        Image description
        <input
          name="altText"
          required
          minLength={3}
          maxLength={250}
          disabled={busy}
        />
      </label>
      <button className="button" disabled={busy}>
        {busy ? "Uploading…" : "Upload image"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
