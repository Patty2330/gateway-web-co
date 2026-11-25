import { getStore } from "@/lib/db";
import { presentScan } from "@/lib/present";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = await getStore();
  const scan = await store.getScan(id);
  if (!scan) return Response.json({ error: "We can't find that check." }, { status: 404 });
  return Response.json(presentScan(scan));
}
