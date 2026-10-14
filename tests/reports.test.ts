import test from "node:test";
import assert from "node:assert/strict";
import {
  reportSchema,
  csvCell,
  csvRows,
  safeInteger,
  signedNaira,
} from "../src/features/reports/rules";
test("reports require real calendar dates, bounded periods/pages and default to real records", () => {
  assert.equal(
    reportSchema.parse({ from: "2026-01-01", to: "2026-01-31" }).scope,
    "REAL",
  );
  for (const bad of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-02-01", to: "2026-01-01" },
    { from: "2024-01-01", to: "2025-01-01" },
    { from: "2026-01-01", to: "2026-01-01", page: 0 },
    { from: "2026-01-01", to: "2026-01-01", role: "OWNER" },
  ])
    assert.equal(reportSchema.safeParse(bad).success, false);
});
test("CSV escapes spreadsheet formulas/newlines/quotes while preserving trusted numeric negative flow", () => {
  for (const text of [
    '=HYPERLINK("https://invalid")',
    " +SUM(1,2)",
    "-1+1",
    "@sum",
    "\t=cmd",
  ])
    assert.ok(csvCell(text).startsWith("\"'"));
  assert.equal(csvCell(-100), '"-100"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.ok(
    csvRows([
      ["a", "b"],
      ["x\ny", "z"],
    ]).endsWith("\r\n"),
  );
  assert.equal(safeInteger(123n), 123);
  assert.throws(() => safeInteger(9007199254740992n));
  assert.ok(signedNaira(-25000).includes("-"));
});
