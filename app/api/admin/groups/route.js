import { isAdmin } from "../../../lib/auth";
import { readGroups, writeGroups } from "../../../lib/groups";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  return Response.json(await readGroups());
}

export async function PUT(request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.groups)) {
    return Response.json({ error: "Ugyldig data." }, { status: 400 });
  }
  return Response.json(await writeGroups(body));
}
