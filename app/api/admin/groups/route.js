import { isAdmin } from "../../../lib/auth";
import { readGroups, writeGroups } from "../../../lib/groups";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  try {
    return Response.json(await readGroups());
  } catch (error) {
    console.error("readGroups feilet:", error);
    return Response.json({ error: error.message || "Klarte ikke å hente grupper." }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.groups)) {
    return Response.json({ error: "Ugyldig data." }, { status: 400 });
  }
  try {
    return Response.json(await writeGroups(body));
  } catch (error) {
    console.error("writeGroups feilet:", error);
    return Response.json({ error: error.message || "Lagring feilet." }, { status: 500 });
  }
}
