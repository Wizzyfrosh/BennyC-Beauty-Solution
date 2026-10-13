"use client";
import { RefreshCw } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container page-section empty-state">
      <h1>Something didn’t load</h1>
      <p>Please try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again <RefreshCw size={16} />
      </button>
    </div>
  );
}
