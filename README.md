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

- **Tre likestilte rangeringskolonner** side om side, i rekkefølge **I går** →
  **Denne uka** (mandag → i går) → **Måneden** (lengst til høyre). Hver kolonne
  er en egen rangering sortert på poeng for den perioden; lederen i hver kolonne
  får 👑. Kolonnene ser like ut – ingen er framhevet.
- **Total andel ført i tide** øverst som en framdriftslinje med strek ved målet
  (80 %) og strek for forrige måneds nivå – linja blir grønn når målet er nådd.
- **Forrige måneds vinner** vises som en egen stripe (🏆), regnet ut fra dagens
  lagsammensetning.
- Topplinja viser Gapit Nordics-logoen (`app/BrandMark.js`), ikke ren tekst.
- **Månedsvelger** ved siden av admin-knappen (`app/MonthPicker.js`): velg en av
  de 12 foregående månedene for å se den ferdige statistikken for den måneden
  (`?month=YYYY-MM`). Da telles hele måneden, «Denne uka»/«I går» skjules, og
  `score.js` henter målmåneden + måneden før (for sammenlikningsstreken).
  «Denne måneden» = ren forside, live.

Utseendet følger Gapit Nordics' merkevareguide (Design System V2): light mode,
Poppins fra Google Fonts, Electric Blue (`#1570EF`, Primary/600) på alt
interaktivt og på framdriftslinjene, grå-skala som fundament, `#039855` (Success)
når 80 %-målet er nådd, og en dempet oransje (Warning-Minor) for vinner/leder og
poeng. Alle farger er CSS-variabler øverst i `app/globals.css`; komponentene er
`TotalBar` / `RankColumn` / `RankRow` / `Track` i `app/page.js`.

**16:9-modus:** gjelder bare forsiden, som har `<main class="page board">`. På
skjermer ≥ 1024 px bred / 560 px høy låses hele poengtavla til `100vh` uten
scrolling – de tre kolonnene deler bredden, radene i hver kolonne deler høyden
likt (`flex: 1 1 0`), og all tekst skaleres med `vh`/`clamp()` så den holder seg
lesbar. Testet med 4–8 lag på 1920×1080 og 1366×768. Adminsiden bruker `.page`
uten `.board` og er en helt vanlig, scrollbar side.

Kode: `app/lib/score.js` – ett `/timesheet/entry`-kall dekker målmåneden +
måneden før, og tallies for måned / uke / i går / forrige måned. Caches i 10
minutter (én nøkkel per måned). Session-token lages med `createSessionToken()`
(cachet ~55 min).

`GET /api/time-stats` finnes fortsatt som et JSON-endepunkt for plusstid i går per
ansatt (`app/lib/timestats.js`), men vises ikke lenger på forsiden.

## Adminside (`/admin`)

- Innlogging med brukernavn/passord (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
  Sesjonen ligger i en signert, httpOnly-cookie.
- Innlogget: opprett grupper, endre gruppenavn, legg til / fjern personer, og
  utpeke én **kaptein** per gruppe (må være medlem av gruppa). Endringer lagres
  i Vercel Blob i produksjon, og i `data/groups.json` lokalt (se «Lagring av
  grupper» under). På forsiden vises ingen personnavn – hver
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

## Lagring av grupper

`app/lib/groups.js` velger lager automatisk:

- **Med `BLOB_READ_WRITE_TOKEN` satt** (produksjon på Vercel): gruppene leses og
  skrives til Vercel Blob under objektet `groups.json`.
- **Uten token** (lokal `npm run dev`): fallback til fila `data/groups.json` i
  prosjektet, akkurat som før.

Sette opp Blob på Vercel:

1. Vercel-dashbordet → prosjektet → **Storage** → **Create Database** → **Blob** →
   koble den til prosjektet. Vercel legger da `BLOB_READ_WRITE_TOKEN` inn som
   miljøvariabel automatisk (Production + Preview + Development).
2. Deploy på nytt. Blob-storen starter tom, så forsiden viser «Ingen grupper er
   satt opp ennå» til gruppene er lagret én gang.
3. Logg inn på `/admin` og trykk lagre (eller «Autofyll tilfeldig») for å skrive
   gruppene til Blob. Alternativt: kjør `vercel env pull .env.local` for å hente
   tokenet lokalt, så vil `npm run dev` skrive rett til Blob.

Storen skal være satt opp med **privat tilgang**. Da lagrer `app/lib/groups.js`
med `access: "private"` og leser via `get()` med tokenet – blob-en er ikke
tilgjengelig via en offentlig URL. Kobler du flere Blob-stores til prosjektet får
tokenet et prefiks (`<store>_BLOB_READ_WRITE_TOKEN`); koden godtar hvilken som
helst variabel som slutter på `BLOB_READ_WRITE_TOKEN`, men helst bør du ha
nøyaktig én store med tomt prefiks.

## Miljøvariabler

Kopier `.env.example` til `.env.local` og fyll inn. De samme variablene brukes
lokalt, i Docker og på Vercel.

```text
TRIPLETEX_CONSUMER_TOKEN
TRIPLETEX_EMPLOYEE_TOKEN
TRIPLETEX_PROXY_COMPANY_ID     # 0 = primærfirma
TRIPLETEX_API_BASE             # https://tripletex.no/v2
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET          # lang tilfeldig streng
BLOB_READ_WRITE_TOKEN         # settes automatisk av Vercel Blob; utelat for fil-lager
```

## Oppstart – lokalt (uten Docker)

```bash
cd tripletex-timestatistikk
cp .env.example .env.local     # 1. fyll inn ekte verdier
npm install                    # 2. installer avhengigheter
npm run dev                    # 3. start utviklingsserver
```

Åpne `http://localhost:3000`. Adminside: `http://localhost:3000/admin`.
Produksjonsbygg lokalt: `npm run build && npm run start`.

## Oppstart – Docker

Krever Docker med Compose. `next.config.mjs` har `output: "standalone"`, og
`Dockerfile` er et flertrinnsbygg som gir et lite image (kun standalone-serveren,
ingen `node_modules`).

```bash
cd tripletex-timestatistikk
cp .env.example .env.local        # 1. fyll inn ekte verdier
docker compose build              # 2. bygg imaget
docker compose up -d              # 3. start containeren i bakgrunnen
```

Appen kjører på `http://localhost:3000`. Nyttige kommandoer:

```bash
docker compose logs -f            # følg loggen
docker compose restart            # start på nytt
docker compose down               # stopp og fjern containeren
docker compose up -d --build      # bygg på nytt og start (etter kodeendring)
```

**Lagring av grupper i Docker:** uten `BLOB_READ_WRITE_TOKEN` skrives gruppene til
det navngitte volumet `gapit-data` (montert på `/app/data`), som overlever
`down`/`up`. Se innholdet med
`docker compose exec web cat data/groups.json`. Med et Blob-token i `.env.local`
brukes Vercel Blob i stedet, og volumet er uten betydning. Uten begge deler
nullstilles gruppene når containeren bygges på nytt.

Kjøre uten Compose:

```bash
docker build -t gapit-timestatistikk .
docker run -d -p 3000:3000 --env-file .env.local \
  -v gapit-data:/app/data --name gapit gapit-timestatistikk
```

## Prosjektstruktur

```text
app/                       Next.js App Router – hele applikasjonen
  layout.js                Rot-layout: laster globals.css, setter <html lang="no">
  page.js                  Forsiden: henter poeng, bygger de tre rangeringskolonnene + totallinje
  globals.css              All styling: Gapit-fargevariabler, komponenter, responsivt + 16:9-modus
  BrandMark.js             Gapit Nordics-logoen (symbol + ordmerke + undertittel) som inline markup
  MonthPicker.js           Klientkomponent: nedtrekk i topplinja for å velge en tidligere måned
  admin/
    page.js                /admin: viser innlogging eller gruppeadministrasjon
    LoginForm.js            Klientskjema for admin-innlogging
    AdminGroups.js          Klient: opprett/endre grupper, sett kaptein, «autofyll tilfeldig»
  api/
    admin/login/route.js    POST: sjekker brukernavn/passord, setter signert cookie
    admin/logout/route.js   POST: sletter sesjonscookien
    admin/groups/route.js   GET/PUT: les og lagre grupper (Blob eller fil), kun innlogget
    admin/employees/route.js GET: aktive/inaktive ansatte fra Tripletex, kun innlogget
    time-stats/route.js     GET: JSON med plusstid i går per ansatt (ikke i bruk på forsiden)
  lib/
    tripletex.js            Tripletex-klient: sesjonstoken, paginering, Oslo-datoer, retry
    auth.js                 Admin-cookie: signering/verifisering og isAdmin()
    groups.js               Lagring av grupper: Vercel Blob i prod, data/groups.json lokalt
    employees.js            Henter ansatte + arbeidsforhold, markerer inaktive
    timestats.js            Plusstid i går: registrerte timer − 7,5 × stillingsandel
    holidays.js             Norske helligdager (isRedDay), brukt til å hoppe over røde dager
    score.js                Poengmodellen: henter føringer og teller «i tide» per periode/måned
data/
  groups.json              Gruppene – lokalt fallback-lager når Blob ikke er satt opp
next.config.mjs            Next-konfig; output: "standalone" for Docker
Dockerfile                 Flertrinnsbygg → lite standalone-image
docker-compose.yml         Bygg + kjør med .env.local og volum for data/
.dockerignore              Hva som holdes utenfor Docker-byggekonteksten
vercel.json                Vercel: framework = nextjs
.env.example               Mal for miljøvariabler
.env.local                 Dine faktiske hemmeligheter (ikke i git)
package.json               Avhengigheter og npm-skript (dev/build/start)
AGENTS.md / CLAUDE.md      Notater til AI-verktøy (AGENTS.md skrives av `next dev`)
README.md                  Denne fila
```
