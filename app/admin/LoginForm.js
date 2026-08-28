"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Innlogging feilet.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught.message);
    } finally {
      // Nullstill alltid, så knappen ikke blir stående på «Logger inn …» hvis
      // refresh av en eller annen grunn ikke bytter til admin-visningen.
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={onSubmit}>
      <h2>Logg inn</h2>
      <label>
        Brukernavn
        <input
          className="search-input"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </label>
      <label>
        Passord
        <input
          className="search-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="download-button primary" type="submit" disabled={busy}>
        {busy ? "Logger inn …" : "Logg inn"}
      </button>
    </form>
  );
}
