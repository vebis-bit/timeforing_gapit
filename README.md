# GAPIT

Forsiden er en **poengtavle** som gamifiserer timeføring: lag samler poeng for å
føre timer i tide. Lag styres fra en adminside.

## Poeng

- Vindu: **inneværende kalendermåned** (1. → i går, kun virkedager).
- For hver ansatt og hver dag de faktisk førte timer:
  - **i tide** = alle føringene for dagen ble opprettet samme dag eller inntil
    1 dag før arbeidsdatoen (`CREATE`-tidspunkt i `entry.changes`) → **+10 poeng**;
  - **for sent** (opprettet etter arbeidsdatoen) eller **for tidlig** (mer enn
    1 dag før) → 0 poeng.
- Dager uten føringer gir ingen poeng (og teller ikke i punktlighets-%).
- Lagpoeng = sum for medlemmene. Punktlighet % = dager i tide / dager med føring.

## Poengtavla (forsiden)

- Lag sortert etter poeng for måneden; lederen får 👑, og «månedsvinner kåres ved
  månedsslutt».
- **Total andel ført i tide** øverst som en framdriftslinje med strek ved målet
  (80 %) og strek for forrige måneds nivå – linja blir grønn når målet er nådd.
- Hver lagrad har tre kompakte framdriftslinjer: **Måneden** (med forrige-måned-
  strek), **Denne uka** (mandag → i går) og **I går**.
- **Forrige måneds vinner** vises som en egen stripe (🏆), regnet ut fra dagens
  lagsammensetning.

Kode: `app/lib/score.js` – ett `/timesheet/entry`-kall dekker forrige + inneværende
måned, og tallies for måned / uke / i går / forrige måned. Caches i 10 minutter.
Session-token lages med `createSessionToken()` (cachet ~55 min).

`GET /api/time-stats` finnes fortsatt som et JSON-endepunkt for plusstid i går per
ansatt (`app/lib/timestats.js`), men vises ikke lenger på forsiden.

## Adminside (`/admin`)

- Innlogging med brukernavn/passord (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
  Sesjonen ligger i en signert, httpOnly-cookie.
- Innlogget: opprett grupper, endre gruppenavn, legg til / fjern personer, og
  utpeke én **kaptein** per gruppe (må være medlem av gruppa). Endringer lagres
  i `data/groups.json` i prosjektet. På forsiden vises ingen personnavn – hver
  ansatt er bare en sirkel med initialer, og kapteinen markeres med ★ på sirkelen.
- Øverst på adminsiden ligger lista **«Ikke plassert i en gruppe»** – alle aktive
  ansatte som ikke er i noen gruppe, hver med et nedtrekk for å legge dem rett i
  en gruppe. Nye grupper legges øverst i gruppelista.
- **Autofyll tilfeldig**: velg antall grupper, så erstattes alle grupper med like
  mange nye grupper (autogenerert navn), og alle aktive ansatte fordeles jevnt og
  tilfeldig mellom dem (Fisher–Yates). Bekreftes med en dialog først.
- En person kan bare være i **én** gruppe. Nedtrekket «Legg til person» viser
  bare folk som ikke er plassert et sted fra før; for å flytte noen må de først
  fjernes fra den gamle gruppa. Dette håndheves også server-side i
  `app/lib/groups.js` (dubletter faller ut, første gruppe vinner).
- Inaktive ansatte (uten arbeidsforhold som dekker «i går») vises ikke på
  forsiden og kan ikke velges til grupper. Eksisterende inaktive medlemmer merkes
  «— inaktiv, bør fjernes» i admin.
- Når man er innlogget vises «admin» øverst til høyre (også på forsiden).

> Merk: `data/groups.json` er en fil i prosjektet. Den overlever ikke en ny
> Vercel-deploy og deles ikke mellom serverinstanser. For delt/varig lagring må
> `app/lib/groups.js` byttes til en database / Vercel KV.

## Lokal kjøring

```bash
cd tripletex-timestatistikk
cp .env.example .env.local   # fyll inn ekte verdier
npm install
npm run dev
```

Åpne `http://localhost:3000`. Adminside: `http://localhost:3000/admin`.

## Miljøvariabler

```text
TRIPLETEX_CONSUMER_TOKEN
TRIPLETEX_EMPLOYEE_TOKEN
TRIPLETEX_PROXY_COMPANY_ID     # 0 = primærfirma
TRIPLETEX_API_BASE             # https://tripletex.no/v2
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET          # lang tilfeldig streng
```
