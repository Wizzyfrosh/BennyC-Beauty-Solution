"use client";
import { useRef, useState } from "react";
export function useOperation() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const saved = useRef<{
    key: string;
    url: string;
    body: unknown;
    method: string;
  } | null>(null);
  async function submit(url: string, body: unknown, method = "POST") {
    if (busy) return null;
    setBusy(true);
    setMessage("");
    const operation =
      uncertain && saved.current
        ? saved.current
        : { key: crypto.randomUUID(), url, body, method };
    saved.current = operation;
    try {
      const response = await fetch(operation.url, {
        method: operation.method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": operation.key,
        },
        body: JSON.stringify(operation.body),
      });
      const data = await response.json();
      if (!response.ok) {
        setUncertain(response.status >= 500);
        setMessage(data.error?.message ?? "The operation could not complete.");
        return null;
      }
      setUncertain(false);
      saved.current = null;
      return data;
    } catch {
      setUncertain(true);
      setMessage(
        "The result could not be confirmed. Keep this form open and retry the same operation before starting another.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, uncertain, submit };
}
export function nairaToKobo(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a valid amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 2000000000)
    throw new Error("The amount is too large.");
  return amount;
}
