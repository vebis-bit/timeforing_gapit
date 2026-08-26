import { getYesterdayPlusstid } from "../../lib/timestats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getYesterdayPlusstid());
  } catch (error) {
    return Response.json({ error: error.message || "Ukjent feil" }, { status: 500 });
  }
}
