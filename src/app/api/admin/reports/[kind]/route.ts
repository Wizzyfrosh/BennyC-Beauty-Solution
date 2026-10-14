import { z } from "zod";
import { adminRoute } from "@/server/admin-route";
import { report, reportCSV } from "@/features/reports/service";
import { reportKinds } from "@/features/reports/rules";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
) {
  return adminRoute(req, true, false, async (actor) => {
    const kind = z.enum(reportKinds).parse((await ctx.params).kind),
      query = Object.fromEntries(new URL(req.url).searchParams);
    const data = await report(actor, kind, query);
    if (query.format !== "csv") return data;
    return new Response(reportCSV(data), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bennyc-${kind}-${data.meta.scope}-${data.meta.from}-${data.meta.to}-page-${data.meta.page}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
