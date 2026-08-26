import Link from "next/link";
import BrandMark from "./BrandMark";
import { isAdmin } from "./lib/auth";
import { readGroups } from "./lib/groups";
import { getRegistrationScore, scoreForMembers } from "./lib/score";
import { Analytics } from "@vercel/analytics/next"

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

// Kompakt linje per lag: [ETIKETT] [====spor====] [verdi]
function MiniBar({ label, value, prevValue = null }) {
  const has = value != null;
  const pct = pctOf(value);
  const prevPct = prevValue == null ? null : pctOf(prevValue);
  const reached = has && pct >= PUNCTUALITY_GOAL;
  return (
    <div
      className={`mini-bar${reached ? " reached" : ""}`}
      role="img"
      aria-label={`${label}: ${has ? `${pct} %` : "ingen føringer"} ført i tide`}
    >
      <span className="mini-bar-l">{label}</span>
      <Track pct={pct} reached={reached} prevPct={prevPct} hasValue={has} />
      <span className="mini-bar-v">{has ? `${pct}%` : "–"}</span>
    </div>
  );
}

export default async function Home() {
  const admin = await isAdmin();

  let score = null;
  let error = null;
  try {
    score = await getRegistrationScore();
  } catch (caught) {
    error = caught;
  }

  const { groups } = await readGroups();

  let ranked = [];
  let prevWinner = null;
  let totalPunctuality = null;
  let prevPunctuality = null;

  if (score) {
    ranked = groups
      .map((group) => {
        const memberIds = group.memberIds.map(String);
        return {
          id: group.id,
          name: group.name,
          score: scoreForMembers(memberIds, score),
          prevScore: score.prev ? scoreForMembers(memberIds, score.prev) : null,
          weekScore: score.week ? scoreForMembers(memberIds, score.week) : null,
          yesterdayScore: score.yesterday ? scoreForMembers(memberIds, score.yesterday) : null
        };
      })
      .sort((a, b) => b.score.points - a.score.points || a.name.localeCompare(b.name, "no"));

    const prevRanked = [...ranked]
      .filter((g) => g.prevScore && g.prevScore.points > 0)
      .sort((a, b) => b.prevScore.points - a.prevScore.points);
    if (prevRanked.length > 0) {
      prevWinner = {
        name: prevRanked[0].name,
        ...prevRanked[0].prevScore,
        monthLabel: score.prev.monthLabel
      };
    }

    const tW = ranked.reduce((n, g) => n + g.score.workedDays, 0);
    const tO = ranked.reduce((n, g) => n + g.score.onTimeDays, 0);
    totalPunctuality = tW > 0 ? (tO / tW) * 100 : null;
    const pW = ranked.reduce((n, g) => n + (g.prevScore?.workedDays ?? 0), 0);
    const pO = ranked.reduce((n, g) => n + (g.prevScore?.onTimeDays ?? 0), 0);
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
                  {score.workdays} virkedager hittil · månedsvinner kåres ved månedsslutt
                </span>
              </div>
            </div>
            {totalPunctuality != null ? (
              <TotalBar value={totalPunctuality} prevValue={prevPunctuality} />
            ) : null}
            <ol className="leaderboard-list">
              {ranked.map((group, index) => {
                const isLeader = index === 0 && group.score.points > 0;
                return (
                  <li key={group.id} className={`lb-row${isLeader ? " leader" : ""}`}>
                    <div className="lb-top">
                      <span className="lb-rank">
                        {isLeader ? "👑" : MEDALS[index] || index + 1}
                      </span>
                      <span className="lb-name">{group.name}</span>
                      <span className="lb-points">
                        <strong>{group.score.points}</strong>p
                      </span>
                    </div>
                    <div className="lb-bars">
                      <MiniBar
                        label="Måneden"
                        value={group.score.punctuality}
                        prevValue={group.prevScore?.punctuality ?? null}
                      />
                      <MiniBar label="Uka" value={group.weekScore?.punctuality ?? null} />
                      <MiniBar label="I går" value={group.yesterdayScore?.punctuality ?? null} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
