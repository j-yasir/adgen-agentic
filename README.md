# AdGen-Agentic

An autonomous multi-agent ad generation system. Onboard a business once (building a **Business Knowledge
Object**, with a real logo and per-product photo galleries), then launch campaigns that a LangGraph pipeline
of specialist agents — Researcher, Strategist, Producer, Auditor — turns into finished ad assets: real
generated static image ads and rendered marketing emails, grounded in the business's actual brand assets,
pausing for your review at key checkpoints along the way.

For the full system design, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (system architecture, API,
durable-execution retry, streaming), [docs/pipeline.md](docs/pipeline.md) (exactly what data flows through
research → strategy, field by field), and [docs/AGENT_ARCHITECTURE.md](docs/AGENT_ARCHITECTURE.md) (the
pattern every agent is built from). The static-image and email sub-agents are documented in
[docs/agents/STATIC_AD_AGENT.md](docs/agents/STATIC_AD_AGENT.md) and
[docs/agents/EMAIL_TEMPLATE_AGENT.md](docs/agents/EMAIL_TEMPLATE_AGENT.md).

This guide gets the whole stack — PostgreSQL, the FastAPI backend, and the Next.js frontend — running
locally on **Linux** or **Windows**, end to end.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.12+ | |
| Node.js | 20+ | Includes `npm` |
| PostgreSQL | 16 | Must have the **pgvector** extension available |
| Docker (recommended) | any recent version | Simplest way to get PostgreSQL + pgvector running on either OS — see §2 |
| A [kie.ai](https://kie.ai) API key | — | The LLM provider actually used by every agent in this project (see [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md#2-technology-stack)) |

You do **not** need Redis, Qdrant, or any other datastore — PostgreSQL is the only persistence service this
project depends on.

---

## 1. Clone the repository

**Linux / macOS**
```bash
git clone <your-repo-url> adGen-agentic
cd adGen-agentic
```

**Windows (PowerShell)**
```powershell
git clone <your-repo-url> adGen-agentic
cd adGen-agentic
```

---

## 2. Start PostgreSQL (+ pgvector)

The project ships an empty `docker-compose.yml` — it is not a working setup path today. The fastest reliable
way to get a correctly-configured database on **either OS** is a single `docker run` against the official
`pgvector/pgvector` image, which bundles PostgreSQL 16 with the extension pre-built.

### Recommended for both Linux and Windows — Docker

```bash
docker run -d --name adgen-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=adgen \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

On Windows, run the identical command from PowerShell with Docker Desktop running — it's the same command,
Docker abstracts the OS difference away entirely. This is the strongly recommended path on Windows
specifically: pgvector has no official prebuilt Windows binaries, so a native install means compiling it
yourself against Visual Studio's build tools — not worth it when Docker gives you the same result in one
command.

Enable the two extensions this project needs (Alembic does **not** do this for you — see
[docs/DATABASE.md §9](docs/DATABASE.md#9-migration-history)):

```bash
docker exec -it adgen-postgres psql -U postgres -d adgen -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### Alternative — native PostgreSQL on Linux

If you already run PostgreSQL locally and prefer not to use Docker:

```bash
sudo apt install postgresql-16 postgresql-16-pgvector   # pgvector package name/availability varies by distro —
                                                          # if unavailable, build from source: https://github.com/pgvector/pgvector#installation
sudo -u postgres createdb adgen
sudo -u postgres psql -d adgen -c "CREATE EXTENSION vector; CREATE EXTENSION pgcrypto;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

> Native Postgres install steps are not documented for Windows here — use the Docker path above.

Either way, you should end up with a database reachable at `localhost:5432`, database name `adgen`, some
user/password pair — you'll put these into `.env` in step 4.

---

## 3. Backend setup

### 3.1 Create and activate a virtual environment

**Linux / macOS**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows (PowerShell)**
```powershell
py -3.12 -m venv venv
venv\Scripts\Activate.ps1
```
> If PowerShell blocks the activation script with an execution-policy error, run
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first, then retry.

**Windows (cmd.exe)**
```cmd
py -3.12 -m venv venv
venv\Scripts\activate.bat
```

### 3.2 Install dependencies

Same command on every platform once the venv is active:

```bash
pip install -r requirements.txt
```

`requirements.txt` pins every package this project actually runs on (generated from a known-working
environment), including the `bcrypt==4.0.1` pin required for compatibility with `passlib` (bcrypt 5.x breaks
it) and a platform marker on `uvloop` (Unix-only; skipped automatically on Windows, uvicorn falls back to
the standard asyncio loop there).

### 3.3 Configure environment variables

Copy the example file and fill it in:

**Linux / macOS**
```bash
cp .env.example .env
```

**Windows**
```powershell
copy .env.example .env
```

Edit `.env`:

```dotenv
# Required — must match whatever you set up in step 2
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/adgen

# Required — the LLM provider every agent actually calls, AND the image
# generation provider (nano-banana, via kie.ai) the Producer agent uses to
# generate real static ad images and email hero images. One key, both uses.
KIE_API_KEY=your-kie-ai-key

# Required in any environment beyond quick local testing — these have insecure
# defaults baked in otherwise
JWT_SECRET_KEY=some-long-random-string
JWT_REFRESH_SECRET_KEY=a-different-long-random-string

# Not required to run the pipeline today — reserved for future/prospected work
# (see docs/ARCHITECTURE.md §16): GOOGLE_API_KEY, ELEVENLABS_API_KEY,
# FIRECRAWL_API_KEY, R2_*. Leave these blank.

APP_ENV=development
LOG_LEVEL=INFO
```

> Note the `postgresql+psycopg2://` scheme specifically — this is a SQLAlchemy dialect prefix, not a plain
> Postgres connection string. It's what `.env.example` already uses and what `config.py` actually expects.

### 3.4 Run database migrations

Alembic reads `DATABASE_URL` straight out of `.env` (see `db/migrations/env.py`) — no separate config needed.

```bash
alembic upgrade head
```

This creates all application tables. Stored procedures (the SQL the app actually executes at runtime — see
[docs/ARCHITECTURE.md §3](docs/ARCHITECTURE.md#3-system-layers)) are loaded automatically the first time the
server starts, not by Alembic.

### 3.5 Start the backend

**Linux / macOS** — a helper script does all three steps (activate, migrate, run) in one go:
```bash
./scripts/backend_dev.sh
```

**Windows** — the `.sh` scripts won't run natively in PowerShell/cmd. Either run them via **Git Bash** or
**WSL** exactly as on Linux, or run the equivalent commands directly:
```powershell
venv\Scripts\Activate.ps1
alembic upgrade head
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Either way, once it's up:
- API base: `http://localhost:8000/api/v1`
- Interactive API docs (Swagger UI): `http://localhost:8000/docs`

---

## 4. Frontend setup

### 4.1 Install dependencies and configure

**Linux / macOS**
```bash
cd frontend
npm install
```

**Windows (PowerShell or cmd)**
```powershell
cd frontend
npm install
```

Create `frontend/.env.local` (same content on both platforms):

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 4.2 Start the frontend

**Linux / macOS** — helper script (auto-installs dependencies if `node_modules` is missing):
```bash
./scripts/frontend_dev.sh
```

**Windows** — run via Git Bash/WSL as above, or directly:
```powershell
cd frontend
npm run dev
```

Frontend runs at `http://localhost:3000` and talks to the backend over REST + Server-Sent Events at the URL
configured in `.env.local`.

> The frontend is a customized/canary build on top of Next.js — see `frontend/AGENTS.md` before making
> frontend code changes; some APIs differ from the Next.js you may be used to.

---

## 5. Load demo data (fastest way to see it working)

The quickest way to confirm the whole stack works — without waiting on live LLM/image-generation calls — is
to load a pre-built demo account: **3 real businesses, 7 products with real photos, 9 campaigns, and 20
already-generated assets** (static image ads + rendered marketing emails), seeded straight into your own
account.

1. Sign up (`POST /api/v1/auth/signup` from `/docs`, or the frontend's sign-up screen) — the response
   includes an `access_token` you can use immediately, no separate login step needed.
2. `POST /api/v1/seed/demo-data`, authenticated as that new user (in Swagger: click **Authorize**, paste the
   `access_token`). Takes a few seconds — it's copying files and inserting DB rows, no network calls.
3. Open the frontend at `http://localhost:3000` and log in — you'll see 3 businesses, each with real
   products (with photos), and campaigns already sitting at `done` with real generated assets in the asset
   gallery (open one to see an actual generated image or a rendered email).

This is safe to call on any fresh account — it refuses (`409`) if the account already has businesses, unless
you explicitly pass `?force=true` (which adds the demo data alongside whatever's already there, rather than
replacing it).

> **Maintainer note**: the demo snapshot itself lives at `seed_data/` (fixture JSON + copied files), produced
> by `python -m scripts.export_seed_data --email <account>`. Re-run that against any real account to refresh
> what gets seeded — the seed endpoint always reads from `seed_data/`, never talks to the source account
> directly.

---

## 6. Or: run a full campaign live, end to end

To actually watch the agents work in real time (real LLM calls, real image generation) rather than look at
pre-generated data:

1. Open `http://localhost:8000/docs`.
2. `POST /api/v1/auth/signup` — create a user (the Swagger example has prefilled test credentials you can
   use directly).
3. `POST /api/v1/businesses` — onboard a business via the form-path fields (see
   [docs/ARCHITECTURE.md §5](docs/ARCHITECTURE.md#5-business-onboarding--bko) for the full field set, or use
   `examples/bko_input_form.json` as a starting payload). Optionally follow up with
   `POST /api/v1/businesses/{id}/logo` and `POST /api/v1/businesses/{id}/products` (+ that product's
   `/images` endpoint) to give the Producer agent real brand assets to ground generation in — without these,
   it still generates images, just without a real product/logo reference.
4. `POST /api/v1/campaigns` — launch a campaign for that business (see `examples/campaign_input_form.json`
   for a sample brief). This returns immediately; the pipeline runs in the background.
5. Either poll `GET /api/v1/campaigns/{id}` for status, or open the frontend at `http://localhost:3000`,
   log in, and watch the campaign's live activity feed (backed by the SSE stream) — including the Producer
   agent's own step-by-step progress as it plans and generates each asset.
6. When the campaign reaches `awaiting_review` (this happens twice — after research, and after the
   strategy is planned), respond via `POST /api/v1/campaigns/{id}/resume` (`{"approved": true}`) from
   Swagger, or approve/reject from the frontend review panel.
7. Once past the second approval, the Producer agent actually generates each asset — check
   `generations/{campaign_id}/image/` and `generations/{campaign_id}/email/` for the real output files as
   they land, alongside the JSON artifacts (`research_report.json`, `strategy_doc.json`) written earlier in
   the run.

**Current agent status**, so expectations match reality:

| Agent | Status |
|---|---|
| Researcher | Real — live web search, produces a full research report |
| Strategist | Real — full plan → produce → assemble pipeline |
| Producer — static image sub-agent | Real — generates real images via nano-banana, grounded in real brand assets when available |
| Producer — email sub-agent | Real — renders a real HTML email from one of 4 templates, including a generated hero image |
| Producer — video ad sub-agent | **Not built** — no video/voice generation provider exists yet; `video_ad` assets in a campaign are silently skipped, not generated |
| Auditor | **Stub** — every asset gets fixed scores and always passes; no real evaluation happens yet |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pip install` fails on a `bcrypt` build error | A newer bcrypt got installed instead of the pinned `4.0.1` | Make sure you're installing from this repo's `requirements.txt`, not a stale environment; `pip install "bcrypt==4.0.1"` explicitly if needed |
| Alembic can't connect / `DATABASE_URL` errors | `.env` missing, wrong scheme, or Postgres not running | Confirm `docker ps` shows `adgen-postgres` up, and `DATABASE_URL` uses `postgresql+psycopg2://` |
| `relation "vector" does not exist` or similar on migration | pgvector/pgcrypto extensions not enabled | Re-run the `CREATE EXTENSION` command from §2 — Alembic does not create these |
| A campaign gets created but nothing happens | `KIE_API_KEY` missing or invalid | The app starts fine without it, but every agent call will fail immediately — check the backend logs for the actual error and confirm `.env` has a real key |
| PowerShell won't run `Activate.ps1` | Default execution policy blocks scripts | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then retry |
| `uvloop` fails to install on Windows | It's a Unix-only package | Already handled by a platform marker in `requirements.txt` — if you still hit this, you're likely using a stale requirements file |
| `POST /seed/demo-data` returns `404 No seed data found` | `seed_data/fixtures.json` doesn't exist in your checkout | Either it wasn't included in your clone, or you're running from a different working directory — run `python -m scripts.export_seed_data --email <account>` against a real account to (re)generate it, or copy an existing `seed_data/` folder in |
| `POST /seed/demo-data` returns `409` | The account already has businesses | Expected — it's a safety guard, not a bug. Pass `?force=true` if you deliberately want to add the demo data alongside existing data |
| A campaign's static image / email assets never appear, stay stuck, or fail | `KIE_API_KEY` invalid, or nano-banana generation timed out (it polls for up to ~6 minutes per image) | Check backend logs for the actual provider error; a slow/failed generation shows up as one `GeneratedAsset(status="failed")` for that asset, not a crashed campaign |
