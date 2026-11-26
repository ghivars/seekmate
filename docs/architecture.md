# Architecture

```
Browser ── /api/v1 (same origin) ──> Next.js ──proxy──> FastAPI ──> PostgreSQL
   └────────── WebSocket /ws/lobbies/{id} ─────────────────┘
```

REST goes through the Next.js rewrite so the refresh cookie stays first-party. WebSockets connect to
the backend directly.

## Backend (`/backend/app`)

| Module | Role |
| --- | --- |
| `main.py` | App factory, CORS, scheduler lifespan |
| `models.py`, `alembic/` | Schema; migrations are the source of truth and CI checks for drift |
| `routers/` | HTTP and WebSocket handlers; they own the transaction (`commit`) |
| `services/` | Queries and state changes; they only `flush` |
| `match.py` | Pure scoring function plus breakdown |
| `realtime.py` | `Broker` interface and `InMemoryBroker` |
| `jobs/retention.py` | Expiry, notice and batched deletion under a Postgres advisory lock |
| `clock.py` | Injectable clock |
| `ratelimit.py`, `moderation.py` | Sliding-window limits, banned words |

### Decisions

- **Auth.** Argon2 hashes. Access JWT (15 min) lives in browser memory. The refresh token is an
  HttpOnly, SameSite=Lax cookie limited to `/api/v1/auth`, rotated on use and stored hashed. Reusing
  an old token after a 10-second grace (parallel tabs) revokes the whole family.
- **WebSocket token.** `POST /auth/ws-token` issues a 60-second token used only in the query string,
  so access tokens never reach logs. The `Origin` header is checked too.
- **Join.** `SELECT ... FOR UPDATE` on the lobby, then count and insert. Two tests fail if the lock
  is removed.
- **Messages.** Committed first, then broadcast. A client-generated `client_id` with a unique
  constraint makes retries idempotent.
- **Access.** One SQL predicate (`accessible_to`) decides which lobbies a user can see. Anything
  outside it is a 404, so existence is not leaked.
- **Blocks.** Both directions. Lobbies created or owned by the other person disappear, membership in
  them ends, the connection is deleted, and messages in shared lobbies are hidden both ways (history
  and live).
- **Connections.** Only people who shared a lobby can connect. Emails are shown only after both
  agree, and the UI says so before either side confirms. A decline looks like "pending" to the
  requester. The table has no foreign key to lobbies.
- **Match.** If the lobby creator has no preferences, the two creator dimensions score 0 and are
  labelled "belum diisi"; unknowns never inflate a score. You do not get a score for your own lobby.
- **Owner leaves.** The longest-standing member becomes owner; if nobody is left the lobby closes.
- **`visibility=closed`** locks a group: only members see it and nobody new can join.

### Additions to the specified schema

`refresh_tokens`, `lobby_slot_alerts`, `usability_events`; `users.code_of_conduct_at`,
`users.onboarded_at`; `lobby_members.last_read_at`, `lobby_members.removed_by_owner`;
`messages.edited_at`, `messages.client_id`; notification type `slot_available`.

### Retention timeline

| When | What |
| --- | --- |
| `ends_at - 7 days` | One `lobby_expiring` notification per member and lobby |
| `ends_at` | Lobbies become `expired` (read-only) |
| `ends_at + grace_days` | Messages, memberships, related notifications and lobbies are deleted in batches; counts go to `retention_log` |

The job also runs once at startup to catch up. Run it by hand with `python -m app.jobs.retention`.

## Frontend (`/frontend/src`)

| Path | Role |
| --- | --- |
| `lib/api` | Client generated from OpenAPI, single-flight token refresh |
| `lib/data.ts` | TanStack Query hooks |
| `lib/chat.ts`, `lib/lobby-socket.ts`, `lib/chat-cache.ts` | Live chat: history, socket with backoff, optimistic outbox |
| `components/shell` | Rail, sidebar, drawers, tab bar, quick switcher |
| `components/lobby` | Lobby view, virtualized messages, composer, join flow |
| `components/ui` | Primitives (native `<dialog>`, top-layer popover, fields) |

Design tokens are CSS variables in `app/globals.css`. A unit test checks every text/surface pair in
both themes for a contrast of at least 4.5:1.
