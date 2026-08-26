"use client";

import { useRouter } from "next/navigation";

// Ligger ved siden av admin-knappen. Bytter måned via ?month=YYYY-MM
// (tom verdi = inneværende måned = ren forside).
export default function MonthPicker({ choices, value }) {
  const router = useRouter();
  return (
    <label className="month-picker">
      <span className="sr-only">Velg måned</span>
      <select
        className="month-select"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          router.push(next ? `/?month=${next}` : "/");
        }}
      >
        {choices.map((choice) => (
          <option key={choice.value || "current"} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}
