import Link from "next/link";
import BrandMark from "./BrandMark";
import MonthPicker from "./MonthPicker";
import { isAdmin } from "./lib/auth";
import { readGroups } from "./lib/groups";
import { getRegistrationScore, scoreForMembers } from "./lib/score";
import { osloDateParts } from "./lib/tripletex";
import { Analytics } from "@vercel/analytics/next";

const MEDALS = ["🥇", "🥈", "🥉"];
const PUNCTUALITY_GOAL = 80;

export const dynamic = "force-dynamic";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pctOf(value) {
  return value == null ? 0 : clamp(Math.round(value), 0, 100);
}

// Selve framdriftssporet: fyll + strek for målet (80 %) + evt. strek for forrige måned.
function Track({ pct, reached, prevPct = null, hasValue = true }) {
  return (
    <div className="bar-track">
      <div
        className={`bar-fill${reached ? " reached" : ""}${hasValue ? "" : " none"}`}
        style={{ width: `${pct}%` }}
      />
      {prevPct != null ? (
        <span
          className="bar-tick prev"
          style={{ left: `${prevPct}%` }}
          title={`Forrige måned ${prevPct} %`}
        />
      ) : null}
      <span
        className="bar-tick goal"
        style={{ left: `${PUNCTUALITY_GOAL}%` }}
        title={`Mål ${PUNCTUALITY_GOAL} %`}
      />
    </div>
  );
}

// Stor framdriftslinje for totalen, med tallverdi og skala.
function TotalBar({ value, prevValue }) {
  const has = value != null;
  const pct = pctOf(value);
  const prevPct = prevValue == null ? null : pctOf(prevValue);
  return (
    <div
      className="total-bar"
      role="img"
      aria-label={`${pct} % ført i tide totalt${
        prevPct == null ? "" : `, forrige måned ${prevPct} %`
      }, mål ${PUNCTUALITY_GOAL} %`}
    >
      <div className="total-bar-num">
        <strong>{pct}</strong>
        <span>%</span>
      </div>
      <div className="total-bar-body">
        <div className="total-bar-cap">
          ført i tide totalt denne måneden
          {prevPct != null ? <em> · forrige måned {prevPct} %</em> : null}
        </div>
        <Track pct={pct} reached={pct >= PUNCTUALITY_GOAL} prevPct={prevPct} hasValue={has} />
        <div className="total-bar-scale">
          <span>0</span>
          <span className="goal-lab" style={{ left: `${PUNCTUALITY_GOAL}%` }}>
            MÅL {PUNCTUALITY_GOAL}%
          </span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

// Én rad i en av de tre rangeringene.
function RankRow({ entry, index, periodKey, showBar, prevKey }) {
  const stat = entry[periodKey];
  const isLeader = index === 0 && stat.points > 0;
  const hasPct = stat.punctuality != null;
  const pct = pctOf(stat.punctuality);
  const prevPct =
    prevKey && entry[prevKey] && entry[prevKey].punctuality != null
      ? pctOf(entry[prevKey].punctuality)
      : null;
  return (
    <li className={`rank-row${isLeader ? " leader" : ""}`}>
      <div className="rank-line">
        <span className="rank-pos">{isLeader ? "👑" : MEDALS[index] || index + 1}</span>
        <span className="rank-name">{entry.name}</span>
        <span className="rank-pts">
          <strong>{stat.points}</strong>p
        </span>
      </div>
      {showBar ? (
        <Track
          pct={pct}
          reached={hasPct && pct >= PUNCTUALITY_GOAL}
          prevPct={prevPct}
          hasValue={hasPct}
        />
      ) : null}
    </li>
  );
}

// Én kolonne = én rangering (måned / uke / i går).
function RankColumn({ variant, title, subtitle, entries, periodKey, showBar = false, prevKey }) {
  return (
    <div className={`rank-col ${variant}`}>
      <div className="rank-col-head">
        <h3>{title}</h3>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {entries.length === 0 ? (
        <p className="rank-empty">Ingen føringer ennå.</p>
      ) : (
        <ol className="rank-list">
          {entries.map((entry, index) => (
            <RankRow
              key={entry.id}
              entry={entry}
              index={index}
              periodKey={periodKey}
              showBar={showBar}
              prevKey={prevKey}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

// Inneværende måned + de 12 foregående, til nedtrekket i topplinja.
function monthChoices() {
  const { year, month } = osloDateParts();
  const fmt = new Intl.DateTimeFormat("nb-NO", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo"
  });
  const list = [];
  for (let i = 0; i <= 12; i++) {
    const d = new Date(Date.UTC(Number(year), Number(month) - 1 - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    list.push({ value: i === 0 ? "" : value, label: i === 0 ? "Denne måneden" : fmt.format(d) });
  }
  return list;
}

export default async function Home({ searchParams }) {
  const admin = await isAdmin();

  const params = (await searchParams) || {};
  const rawMonth = typeof params.month === "string" ? params.month : null;
  const { year: nowY, month: nowM } = osloDateParts();
  const monthParam =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) && rawMonth < `${nowY}-${nowM}` ? rawMonth : null;
  const choices = monthChoices();

  let score = null;
  let error = null;
  try {
    score = await getRegistrationScore({ month: monthParam });
  } catch (caught) {
    error = caught;
  }

  const { groups } = await readGroups();

  let monthRanked = [];
  let weekRanked = [];
  let yesterdayRanked = [];
  let prevWinner = null;
  let totalPunctuality = null;
  let prevPunctuality = null;

  if (score) {
    const rows = groups.map((group) => {
      const memberIds = group.memberIds.map(String);
      return {
        id: group.id,
        name: group.name,
        month: scoreForMembers(memberIds, score),
        week: score.week ? scoreForMembers(memberIds, score.week) : null,
        yesterday: score.yesterday ? scoreForMembers(memberIds, score.yesterday) : null,
        prev: score.prev ? scoreForMembers(memberIds, score.prev) : null
      };
    });

    // Samme lag, tre uavhengige rangeringer – sortert på poeng for hver periode.
    const rankBy = (key) =>
      rows
        .filter((row) => row[key])
        .sort(
          (a, b) => b[key].points - a[key].points || a.name.localeCompare(b.name, "no")
        );

    monthRanked = rankBy("month");
    weekRanked = rankBy("week");
    yesterdayRanked = rankBy("yesterday");

    const prevRanked = rows
      .filter((row) => row.prev && row.prev.points > 0)
      .sort((a, b) => b.prev.points - a.prev.points);
    if (prevRanked.length > 0) {
      prevWinner = {
        name: prevRanked[0].name,
        ...prevRanked[0].prev,
        monthLabel: score.prev.monthLabel
      };
    }

    const tW = rows.reduce((n, r) => n + r.month.workedDays, 0);
    const tO = rows.reduce((n, r) => n + r.month.onTimeDays, 0);
    totalPunctuality = tW > 0 ? (tO / tW) * 100 : null;
    const pW = rows.reduce((n, r) => n + (r.prev?.workedDays ?? 0), 0);
    const pO = rows.reduce((n, r) => n + (r.prev?.onTimeDays ?? 0), 0);
    prevPunctuality = pW > 0 ? (pO / pW) * 100 : null;
  }

  return (
    <main className="page board">
      <header className="topbar">
        <div>
          <p className="eyebrow">Poengtavle</p>
          <h1 className="brand">
            <BrandMark />
          </h1>
        </div>
        <div className="top-actions">
          <MonthPicker choices={choices} value={monthParam || ""} />
          {admin ? (
            <Link className="badge" href="/admin">
              admin
            </Link>
          ) : (
            <Link className="login-link" href="/admin">
              Logg inn
            </Link>
          )}
        </div>
      </header>

      {error ? (
        <section className="error-box">
          <h2>Klarte ikke å hente data</h2>
          <p>{error.message}</p>
        </section>
      ) : groups.length === 0 ? (
        <p className="empty">
          Ingen grupper er satt opp ennå.{" "}
          {admin ? <Link href="/admin">Opprett grupper</Link> : "Logg inn som admin for å lage grupper."}
        </p>
      ) : !score ? (
        <p className="empty">Kunne ikke hente poeng akkurat nå. Prøv igjen om litt.</p>
      ) : (
        <>
          {prevWinner ? (
            <p className="prev-winner">
              <span className="prev-winner-ico">🏆</span>
              <span>
                Vinner {prevWinner.monthLabel}: <strong>{prevWinner.name}</strong> ·{" "}
                {prevWinner.points} poeng
                {prevWinner.punctuality != null ? ` · ${prevWinner.punctuality} % i tide` : ""}
              </span>
            </p>
          ) : null}

          <section className="leaderboard">
            <div className="section-header">
              <div>
                <h2>{score.monthLabel}</h2>
                <span>
                  Poeng for timer ført i tide (samme dag eller dagen før) ·{" "}
                  {score.workdays} virkedager
                  {score.historical
                    ? " · ferdig måned"
                    : " hittil · månedsvinner kåres ved månedsslutt"}
                </span>
              </div>
            </div>
            {totalPunctuality != null ? (
              <TotalBar value={totalPunctuality} prevValue={prevPunctuality} />
            ) : null}
            <div className={`rankings${score.historical ? " solo" : ""}`}>
              <RankColumn
                variant="primary"
                title="Måneden"
                subtitle={`Poeng ${score.historical ? "for" : "hittil i"} ${score.monthLabel.toLowerCase()}`}
                entries={monthRanked}
                periodKey="month"
                prevKey="prev"
                showBar
              />
              {!score.historical ? (
                <>
                  <RankColumn
                    variant="secondary"
                    title="Denne uka"
                    subtitle="Mandag – i går"
                    entries={weekRanked}
                    periodKey="week"
                  />
                  <RankColumn
                    variant="secondary"
                    title="I går"
                    subtitle="Siste virkedag"
                    entries={yesterdayRanked}
                    periodKey="yesterday"
                  />
                </>
              ) : null}
            </div>
          </section>
        </>
      )}
      <Analytics />
    </main>
  );
}
