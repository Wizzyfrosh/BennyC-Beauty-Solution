export default function Loading() {
  return (
    <div
      className="container page-section"
      aria-busy="true"
      aria-label="Loading the collection"
    >
      <div className="skeleton skeleton-heading" />
      <div className="product-grid">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton skeleton-card" />
        ))}
      </div>
      <p role="status">Loading the collection…</p>
    </div>
  );
}
