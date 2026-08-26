import Link from "next/link";
import { isAdmin } from "../lib/auth";
import AdminGroups from "./AdminGroups";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await isAdmin();

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>GAPIT</h1>
          <p className="eyebrow">
            <Link href="/">← Til forsiden</Link>
          </p>
        </div>
        <div className="top-actions">{admin ? <span className="badge">admin</span> : null}</div>
      </header>

      {admin ? (
        <>
          <h2>Grupper</h2>
          <AdminGroups />
        </>
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
