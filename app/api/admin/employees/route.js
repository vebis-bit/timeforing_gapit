// GET /api/admin/employees – ansattlista fra Tripletex som { employees: [{ id,
// name, active }] }. Krever admin-sesjon. Brukes av gruppe-editoren.

import { isAdmin } from "../../../lib/auth";
import { listEmployees } from "../../../lib/employees";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  try {
    const employees = (await listEmployees()).map((employee) => ({
      id: employee.id,
      name: employee.name,
      active: employee.active
    }));
    return Response.json({ employees });
  } catch (error) {
    return Response.json({ error: error.message || "Ukjent feil" }, { status: 500 });
  }
}
