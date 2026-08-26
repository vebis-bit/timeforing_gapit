# GAPIT

Poengtavle som gamifiserer timeføring i Tripletex: lag samler poeng for hver dag
en ansatt fører timene sine i tide (samme dag eller dagen før). Next.js
(App Router). Lagene settes opp på en adminside.

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
| `BLOB_READ_WRITE_TOKEN` | Valgfri. Settes automatisk av Vercel Blob. Uten den lagres gruppene i `data/groups.json`. |

### 3a. Kjøre lokalt (Node)

```bash
npm install
npm run dev          # utviklingsserver på http://localhost:3000
```

Produksjonsbygg lokalt: `npm run build && npm run start`.

### 3b. Kjøre i Docker

`next.config.mjs` har `output: "standalone"`, og `Dockerfile` er et
flertrinnsbygg som gir et lite image uten `node_modules`.

Med Compose (`docker compose` i nyere Docker, `docker-compose` i eldre):

```bash
docker compose up -d --build      # bygg og start
docker compose logs -f            # følg loggen
docker compose down               # stopp
```

Uten Compose:

```bash
docker build -t gapit .
docker run -d -p 3000:3000 --env-file .env.local -v gapit-data:/app/data --name gapit gapit
```

Uten `BLOB_READ_WRITE_TOKEN` lagres gruppene i det navngitte volumet `gapit-data`
(`/app/data` i containeren). Se innholdet med
`docker compose exec web cat data/groups.json`.

### 3c. Deploye til Vercel

Push til `main`. `vercel.json` setter framework. Legg inn miljøvariablene i
prosjektet, og koble på en **privat** Vercel Blob-store for varig gruppelagring –
da settes `BLOB_READ_WRITE_TOKEN` automatisk. Miljøvariabler bindes ved
deploy-tidspunkt, så redeploy etter at storen er koblet på.

---

## Filer

### Rot

| Fil | Funksjon |
| --- | --- |
| `package.json` | Avhengigheter og skript: `dev`, `build`, `start`. |
| `next.config.mjs` | Next-konfig. `output: "standalone"` for Docker-imaget. |
| `vercel.json` | Forteller Vercel at rammeverket er Next.js. |
| `Dockerfile` | Flertrinns Docker-bygg → lite standalone-image. |
| `docker-compose.yml` | Bygg + kjør med `.env.local` og volum for gruppene. |
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
| `groups.js` | Lagring av lag. Vercel Blob når et Blob-token finnes, ellers `data/groups.json`. |
| `employees.js` | Henter ansatte og arbeidsforhold fra Tripletex, markerer inaktive. |
| `holidays.js` | Norske helligdager (`isRedDay`) for å hoppe over røde dager. |
| `score.js` | Poengmodellen. Henter føringer for målmåneden + måneden før, teller «i tide» per dag og summerer per lag for måned / uke / i går. Cachet i 10 min per måned. |

### `data/`

| Fil | Funksjon |
| --- | --- |
| `groups.json` | Lagene. Lokalt fallback-lager når Vercel Blob ikke er satt opp. |
