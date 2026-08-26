"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `g-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Navn til autogenererte grupper.
const NAME_POOL = [
  "Bjørnene",
  "Ulvene",
  "Revene",
  "Elgene",
  "Falkene",
  "Ørnene",
  "Gaupene",
  "Jervene",
  "Oterne",
  "Harene",
  "Grevlingene",
  "Mårene",
  "Hubroene",
  "Ekornene",
  "Hjortene",
  "Villsvinene",
  "Selene",
  "Nisene",
  "Lemenene",
  "Røyskattene",
  "Måkene",
  "Ravnene",
  "Tiurene",
  "Lirypene"
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AdminGroups() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");
  const [groupCount, setGroupCount] = useState(3);
  const saveTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [groupsRes, employeesRes] = await Promise.all([
          fetch("/api/admin/groups"),
          fetch("/api/admin/employees")
        ]);
        const groupsData = await groupsRes.json();
        const employeesData = await employeesRes.json();
        if (!groupsRes.ok) throw new Error(groupsData.error || "Klarte ikke å hente grupper.");
        if (!employeesRes.ok) throw new Error(employeesData.error || "Klarte ikke å hente ansatte.");
        if (cancelled) return;
        setGroups(groupsData.groups || []);
        setEmployees(employeesData.employees || []);
      } catch (caught) {
        if (!cancelled) setError(caught.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const employeeById = useMemo(() => {
    const map = new Map();
    for (const employee of employees) map.set(String(employee.id), employee);
    return map;
  }, [employees]);

  function persist(next, { debounce = false } = {}) {
    setGroups(next);
    setStatus("Lagrer …");
    const run = async () => {
      try {
        const response = await fetch("/api/admin/groups", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groups: next })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Lagring feilet.");
        setGroups(data.groups || next);
        setStatus("Lagret");
      } catch (caught) {
        setStatus("");
        setError(caught.message);
      }
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (debounce) {
      saveTimer.current = setTimeout(run, 600);
    } else {
      run();
    }
  }

  function addGroup() {
    // Nye grupper legges øverst i lista.
    persist([{ id: newId(), name: "Ny gruppe", memberIds: [], captainId: null }, ...groups]);
  }

  // Erstatter alle grupper med `count` nye, tilfeldig navngitte grupper, og
  // fordeler alle aktive ansatte jevnt og tilfeldig mellom dem.
  function autofillGroups() {
    const pool = employees.filter((e) => e.active !== false).map((e) => String(e.id));
    const count = Math.max(1, Math.min(Math.floor(groupCount) || 1, pool.length));
    const ok = window.confirm(
      `Dette erstatter alle eksisterende grupper med ${count} nye, tilfeldig fylte grupper (${pool.length} ansatte). Fortsette?`
    );
    if (!ok) return;

    const names = shuffle(NAME_POOL).slice(0, count);
    while (names.length < count) names.push(`Gruppe ${names.length + 1}`);

    const next = names.map((name) => ({ id: newId(), name, memberIds: [], captainId: null }));
    shuffle(pool).forEach((id, index) => {
      next[index % count].memberIds.push(id);
    });
    persist(next);
  }

  function deleteGroup(id) {
    persist(groups.filter((group) => group.id !== id));
  }

  function renameGroup(id, name) {
    persist(
      groups.map((group) => (group.id === id ? { ...group, name } : group)),
      { debounce: true }
    );
  }

  function addMember(groupId, employeeId) {
    if (!employeeId) return;
    // En person kan bare være i én gruppe – ignorer hvis alt er plassert et sted.
    if (groups.some((group) => group.memberIds.includes(employeeId))) return;
    persist(
      groups.map((group) =>
        group.id === groupId
          ? { ...group, memberIds: [...group.memberIds, employeeId] }
          : group
      )
    );
  }

  function removeMember(groupId, employeeId) {
    persist(
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              memberIds: group.memberIds.filter((id) => id !== employeeId),
              captainId: group.captainId === employeeId ? null : group.captainId
            }
          : group
      )
    );
  }

  function setCaptain(groupId, employeeId) {
    persist(
      groups.map((group) =>
        group.id === groupId
          ? { ...group, captainId: group.captainId === employeeId ? null : employeeId }
          : group
      )
    );
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  if (loading) return <p className="empty">Laster …</p>;

  const assignedIds = new Set(groups.flatMap((g) => g.memberIds.map(String)));
  const activeCount = employees.filter((employee) => employee.active !== false).length;
  const ungrouped = employees.filter(
    (employee) => employee.active !== false && !assignedIds.has(String(employee.id))
  );

  return (
    <>
      <div className="admin-toolbar">
        <button className="download-button" type="button" onClick={addGroup}>
          Ny gruppe
        </button>
        <span className="save-status">{status}</span>
        <button className="download-button" type="button" onClick={logout}>
          Logg ut
        </button>
      </div>

      <div className="admin-autofill">
        <label>
          Antall grupper
          <input
            className="search-input"
            type="number"
            min="1"
            max={activeCount || 1}
            value={groupCount}
            onChange={(event) => setGroupCount(Number(event.target.value))}
          />
        </label>
        <button className="download-button primary" type="button" onClick={autofillGroups}>
          Autofyll tilfeldig
        </button>
        <span className="hint">
          Erstatter alle grupper. {activeCount} aktive ansatte fordeles jevnt og tilfeldig,
          med generert gruppenavn.
        </span>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="table-section admin-group">
        <div className="section-header">
          <div>
            <h2>Ikke plassert i en gruppe</h2>
            <span>{ungrouped.length} ansatte</span>
          </div>
        </div>
        {ungrouped.length === 0 ? (
          <p className="empty">Alle aktive ansatte er plassert i en gruppe.</p>
        ) : (
          <ul className="member-list">
            {ungrouped.map((employee) => (
              <li key={employee.id}>
                <span>{employee.name}</span>
                {groups.length > 0 ? (
                  <span className="member-actions">
                    <select
                      className="search-input"
                      defaultValue=""
                      aria-label={`Legg ${employee.name} i en gruppe`}
                      onChange={(event) => {
                        addMember(event.target.value, String(employee.id));
                        event.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        Legg i gruppe …
                      </option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.length === 0 ? (
        <p className="empty">Ingen grupper ennå. Trykk «Ny gruppe».</p>
      ) : (
        groups.map((group) => {
          const available = ungrouped;
          return (
            <section key={group.id} className="table-section admin-group">
              <div className="section-header">
                <input
                  className="search-input group-name"
                  type="text"
                  value={group.name}
                  onChange={(event) => renameGroup(group.id, event.target.value)}
                  aria-label="Gruppenavn"
                />
                <button
                  className="download-button danger"
                  type="button"
                  onClick={() => deleteGroup(group.id)}
                >
                  Slett gruppe
                </button>
              </div>

              <ul className="member-list">
                {group.memberIds.length === 0 ? (
                  <li className="empty">Ingen medlemmer.</li>
                ) : (
                  group.memberIds.map((id) => {
                    const isCaptain = group.captainId === id;
                    const employee = employeeById.get(String(id));
                    const inactive = employee?.active === false;
                    return (
                      <li key={id} className={isCaptain ? "is-captain" : ""}>
                        <span>
                          {isCaptain ? "★ " : ""}
                          {employee?.name || `Ukjent (${id})`}
                          {inactive ? " — inaktiv, bør fjernes" : ""}
                        </span>
                        <span className="member-actions">
                          <button
                            type="button"
                            className={isCaptain ? "captain-on" : ""}
                            onClick={() => setCaptain(group.id, id)}
                          >
                            {isCaptain ? "Fjern kaptein" : "Gjør til kaptein"}
                          </button>
                          <button type="button" onClick={() => removeMember(group.id, id)}>
                            Fjern
                          </button>
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>

              <div className="add-member">
                <select
                  className="search-input"
                  defaultValue=""
                  onChange={(event) => {
                    addMember(group.id, event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="" disabled>
                    Legg til person …
                  </option>
                  {available.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Kun personer som ikke er i en gruppe fra før. Fjern personen fra
                  den andre gruppa for å flytte.
                </span>
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
