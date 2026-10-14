// Isolated CI fixture only; no application endpoint can change provider responses.
import { createServer } from "node:http";
if (
  process.env.CI !== "true" ||
  new URL(process.env.DATABASE_URL ?? "https://invalid").pathname !==
    "/bennyc_ci" ||
  process.env.PAYSTACK_API_ORIGIN !== "http://127.0.0.1:4010"
)
  throw Error("Requires isolated CI configuration");
const transactions = new Map<string, Record<string, unknown>>(),
  refunds = new Map<string, Record<string, unknown>>();
let sequence = 100000;
createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (
    req.headers.authorization !== `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
  ) {
    res.statusCode = 401;
    res.end("{}");
    return;
  }
  const url = new URL(req.url!, "http://127.0.0.1:4010");
  let input: Record<string, unknown> = {};
  if (req.method === "POST") {
    let bytes = "";
    for await (const chunk of req) {
      bytes += chunk;
      if (bytes.length > 20000) {
        res.statusCode = 413;
        res.end("{}");
        return;
      }
    }
    input = JSON.parse(bytes);
  }
  let data: unknown;
  if (url.pathname === "/__fixture/transaction") {
    const previous = transactions.get(String(input.reference));
    data = { ...previous, ...input };
    transactions.set(String(input.reference), data as Record<string, unknown>);
  } else if (url.pathname === "/__fixture/refund") {
    refunds.set(String(input.id), input);
    data = input;
  } else if (url.pathname === "/transaction/initialize") {
    const reference = String(input.reference);
    if (!transactions.has(reference))
      transactions.set(reference, {
        id: sequence++,
        reference,
        amount: Number(input.amount),
        currency: "NGN",
        domain: "test",
        status: "pending",
      });
    data = {
      reference,
      authorization_url: `https://checkout.paystack.com/fixture-${reference}`,
    };
  } else if (url.pathname.startsWith("/transaction/verify/")) {
    const t = transactions.get(decodeURIComponent(url.pathname.slice(20)));
    data = t
      ? { ...t, reference: t.responseReference ?? t.reference }
      : undefined;
  } else if (url.pathname.startsWith("/transaction/")) {
    data = [...transactions.values()].find(
      (t) => String(t.id) === url.pathname.slice(13),
    );
  } else if (url.pathname.startsWith("/refund/")) {
    data = refunds.get(url.pathname.slice(8));
  }
  if (
    !url.pathname.startsWith("/__fixture/") &&
    data &&
    typeof data === "object" &&
    "unavailable" in data &&
    data.unavailable
  ) {
    res.statusCode = 503;
    res.end(JSON.stringify({ status: false }));
    return;
  }
  if (!data) {
    res.statusCode = 404;
    res.end(JSON.stringify({ status: false }));
    return;
  }
  res.end(JSON.stringify({ status: true, data }));
}).listen(4010, "127.0.0.1");
