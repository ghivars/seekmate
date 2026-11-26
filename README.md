# SeekMate

SeekMate helps university students find classmates and study partners **before** course
registration (KRS). Each course is a space; inside it students create or preview small lobbies,
join with a short introduction, and chat. The UI is in Indonesian.

Match scores compare study preferences only. They never imply identical class schedules, and the UI
says so next to every score.

## Quick start with Docker

```
cp .env.example .env
docker compose up --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/api/v1/docs
- Migrations and the demo seed run automatically (`SEED_ON_START=true`).
- Verification links are printed in the backend log: `docker compose logs -f backend`.

## Quick start without Docker

Needs [uv](https://docs.astral.sh/uv/) and Node 22. PostgreSQL 16 binaries come from a Python wheel,
so nothing has to be installed system-wide.

```
cd backend
uv sync
uv run python scripts/local_pg.py start     # Postgres on 127.0.0.1:55432
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --port 8000
```

In a second terminal:

```
cd frontend
npm ci
npm run dev
```

Stop the database with `uv run python scripts/local_pg.py stop`. On Windows keep the checkout on a
short path (for example `C:\dev\seekmate`): the bundled Postgres does not support paths longer than
260 characters. You can also point `UV_PROJECT_ENVIRONMENT` and `SEEKMATE_PGDATA` at short paths.

The Makefile wraps the same commands (`make install db-local migrate seed backend frontend test`).

## Demo accounts

The seed creates sample courses, one active semester and accounts labelled "(demo)": `rani`, `bima`,
`sari`, `yoga` and `admin`, all `@demo.seekmate.example`. The shared password is `DEMO_PASSWORD` in
[backend/app/seed.py](backend/app/seed.py). Seeding refuses to run when `ENVIRONMENT=production`.
Seed data is fictional and never represents real users or statistics.

To chat as two people on one machine, open http://localhost:3000 and http://127.0.0.1:3000; the two
hosts have separate cookies.

## Tests

| What | Command |
| --- | --- |
| Backend (needs Postgres) | `cd backend && uv run pytest -q` |
| Frontend | `cd frontend && npm test` |
| Lint and types | `make lint` |
| Migrations match models | `cd backend && uv run alembic check` |

Backend tests use `TEST_DATABASE_URL` (default: the `seekmate_test` database created by
`local_pg.py`). **That database is wiped.** The suite runs the real migrations, a real uvicorn
server for WebSocket tests, and a fake clock for retention.

After changing the API, run `make openapi` to regenerate `frontend/openapi.json` and the typed
client. CI fails when they are stale.

## Environment variables

See [.env.example](.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `postgresql+asyncpg://...` |
| `SECRET_KEY` | JWT signing key. Must be unique and 32+ characters in production |
| `ENVIRONMENT` | `development`, `test` or `production` (enables startup safety checks) |
| `ALLOWED_EMAIL_DOMAINS` | Campus domains that may register, comma separated |
| `CORS_ORIGINS` | Allowed browser origins; also checked on WebSocket connections |
| `FRONTEND_URL` | Base URL in verification emails |
| `COOKIE_SECURE` | Must be `true` in production (HTTPS) |
| `FORWARDED_ALLOW_IPS` | Proxies whose `X-Forwarded-For` is trusted for rate limiting |
| `LOGIN_RATE`, `LOGIN_EMAIL_RATE`, `REGISTER_RATE`, `MESSAGE_RATE`, `LOBBY_CREATE_RATE` | `count/seconds` |
| `WEIGHT_*` | Match weights; must sum to 1 |
| `BANNED_WORDS` | Comma separated |
| `RETENTION_HOUR_UTC`, `SCHEDULER_ENABLED` | Daily retention job |
| `BACKEND_URL` | Where Next.js proxies `/api/v1` (build time) |
| `NEXT_PUBLIC_WS_URL` | WebSocket base the browser uses (build time) |
| `USABILITY_TEST_MODE`, `NEXT_PUBLIC_USABILITY_TEST` | Anonymous usability metrics, off by default |

## Usability-test mode

When both flags are on, the app records `time_to_first_join`, `join` and `first_message` with a
random per-tab key. No user id is stored. Example query for the median time to first join:

```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_ms)
FROM usability_events WHERE event = 'time_to_first_join';
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for the module map, data model additions and key
decisions.

## Known limitations

- **One backend process.** Realtime fan-out, presence and rate limits live in memory. Scale out by
  implementing `Broker` (`app/realtime.py`) and `RateLimiter` (`app/ratelimit.py`) on Redis.
- **Presence** means "has a lobby open". Someone reading Beranda appears offline.
- **Email** is only logged to the console. Implement `Mailer` in `app/mailer.py` before production.
- **No password reset** and no email change yet.
- **No admin screen for semesters and courses.** Manage them through SQL or a seed script.
- **PWA**: installable manifest and icons, but no service worker, offline mode or push.
- **Banned words** is a simple word list; it does not understand context.
- **Reports** keep a short text copy (up to 500 characters) after the lobby is deleted.
- Lists are capped (200 lobbies per course, 60 courses per search, 100 reports) without paging.
