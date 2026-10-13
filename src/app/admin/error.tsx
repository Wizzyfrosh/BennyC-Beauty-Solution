"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="standalone-page">
      <h1>Workspace temporarily unavailable</h1>
      <p>Your session or connection could not be checked. Please try again.</p>
      <button onClick={reset} className="button">
        Try again
      </button>
    </main>
  );
}
