# GAPIT

Poengtavle som gamifiserer timeføring i Tripletex: lag samler poeng for hver dag
en ansatt fører timene sine i tide (samme dag eller dagen før). Next.js
(App Router). Lagene settes opp på en adminside. Kjøres som Docker-container på
privat nett; gruppene lagres i `data/groups.json` (montert som volum).

---

## Oppstart

### 1. Forutsetninger

- Node 20 eller nyere (utviklet på Node 22).
- Tripletex API-tokens: ett consumer-token og ett employee-token.
- Kun for containerkjøring: en Docker-motor som faktisk kjører – Docker Desktop,
  eller `brew install colima docker-buildx docker-compose && colima start`.
  (Bare `brew install docker` gir CLI uten motor og fungerer ikke alene.)

### 2. Miljøvariabler

Kopier malen og fyll inn:

```bash
cp .env.example .env.local
```

| Variabel | Forklaring |
| --- | --- |
| `TRIPLETEX_CONSUMER_TOKEN` | Consumer-token fra Tripletex. Påkrevd. |
| `TRIPLETEX_EMPLOYEE_TOKEN` | Employee-token fra Tripletex. Påkrevd. |
| `TRIPLETEX_PROXY_COMPANY_ID` | `0` = primærfirma. Sett til datterselskapets id ved proxy. |
| `TRIPLETEX_API_BASE` | `https://tripletex.no/v2`. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Innlogging til `/admin`. |
| `ADMIN_SESSION_SECRET` | Lang tilfeldig streng. Signerer admin-sesjonscookien. |

### 3a. Kjøre lokalt (Node)

```bash
npm install
npm run dev          # utviklingsserver på http://localhost:3000
```

Produksjonsbygg lokalt: `npm run build && npm run start`.

### 3b. Kjøre i Docker

Alt du trenger er Docker (med motor) + ett skript:

```bash
./run.sh
```

Det oppretter `.env.local` fra malen første gang (fyll inn og kjør på nytt),
velger riktig Compose-kommando, bygger imaget og starter containeren.
Appen kjører på http://localhost:3000 og starter automatisk igjen etter omstart
av maskinen.

Alle avhengigheter installeres **inne i imaget** (`npm ci` + Next
«standalone»-bygg) – ingenting installeres på maskinen utenom Docker selv.

Manuelt, hvis du heller vil:

```bash
cp .env.example .env.local          # fyll inn
docker compose up -d --build        # eldre Docker: docker-compose
docker compose logs -f              # følg loggen
docker compose down                 # stopp
```

Gruppene lagres i volumet `gapit-data` (`/app/data` i containeren), som overlever
`down`/`up` og nye bygg. Se innholdet med
`docker compose exec web cat data/groups.json`.

---

## Filer

### Rot

| Fil | Funksjon |
| --- | --- |
| `package.json` | Avhengigheter og skript: `dev`, `build`, `start`. |
| `next.config.mjs` | Next-konfig. `output: "standalone"` for Docker-imaget. |
| `run.sh` | Ett-kommando oppstart i Docker: lager `.env.local`, bygger og starter. |
| `Dockerfile` | Flertrinns Docker-bygg → lite standalone-image med alle pakker. |
| `docker-entrypoint.sh` | Kjører som root: fikser eierskap på `/app/data`-volumet, seeder tom `groups.json`, dropper så til `node`. |
| `docker-compose.yml` | Bygg + kjør med `.env.local`, volum for gruppene, healthcheck. |
| `fly.toml` | Klar Fly.io-konfig: port 3000, `/app/data`-volum, helsesjekk. |
| `.dockerignore` | Hva som holdes utenfor Docker-byggekonteksten. |
| `.env.example` | Mal for miljøvariabler. Kopieres til `.env.local`. |
| `.gitignore` | Ignorerte filer (`node_modules`, `.next`, `.env.local`, …). |
| `AGENTS.md` / `CLAUDE.md` | Notater til AI-verktøy. `AGENTS.md` skrives av `next dev`. |

### `app/` – applikasjonen (Next.js App Router)

| Fil | Funksjon |
| --- | --- |
| `layout.js` | Rot-layout. Laster `globals.css`, setter `<html lang="no">`. |
| `page.js` | Forsiden. Henter poeng og tegner tre likestilte rangeringskolonner (I går → Denne uka → Måneden) pluss totallinja «andel ført i tide». |
| `globals.css` | All styling: Gapit-fargevariabler (light mode, Electric Blue), komponenter, responsivt oppsett og 16:9-storskjermmodus. |
| `BrandMark.js` | Gapit Nordics-logoen i topplinja (symbol + ordmerke + undertittel). |
| `MonthPicker.js` | Klientkomponent. Nedtrekk ved siden av admin-knappen for å se en tidligere måned (`?month=YYYY-MM`). |

### `app/admin/` – adminside

| Fil | Funksjon |
| --- | --- |
| `page.js` | `/admin`. Viser innloggingsskjema eller gruppeadministrasjon. |
| `LoginForm.js` | Klientskjema for admin-innlogging. |
| `AdminGroups.js` | Klient. Opprett/endre lag, legg til/fjern personer, sett kaptein, «autofyll tilfeldig». |

### `app/api/` – serverruter

| Fil | Funksjon |
| --- | --- |
| `admin/login/route.js` | `POST`: sjekker brukernavn/passord, setter signert httpOnly-cookie. |
| `admin/logout/route.js` | `POST`: sletter sesjonscookien. |
| `admin/groups/route.js` | `GET`/`PUT`: les og lagre lag. Krever innlogging. |
| `admin/employees/route.js` | `GET`: ansatte fra Tripletex med aktiv/inaktiv-status. Krever innlogging. |

### `app/lib/` – serverhjelpere

| Fil | Funksjon |
| --- | --- |
| `tripletex.js` | Tripletex-klient: sesjonstoken (cachet), paginering, Oslo-datoer, retry. |
| `auth.js` | Admin-cookie: signering og verifisering, `isAdmin()`. |
| `groups.js` | Lagring av lag: leser/skriver `data/groups.json`. |
| `employees.js` | Henter ansatte og arbeidsforhold fra Tripletex, markerer inaktive. |
| `holidays.js` | Norske helligdager (`isRedDay`) for å hoppe over røde dager. |
| `score.js` | Poengmodellen. Henter føringer for målmåneden + måneden før, teller «i tide» per dag og summerer per lag for måned / uke / i går. Cachet i 10 min per måned. |

### `data/`

| Fil | Funksjon |
| --- | --- |
| `groups.json` | Lagene. Eneste datalager – monteres som volum i Docker. |
