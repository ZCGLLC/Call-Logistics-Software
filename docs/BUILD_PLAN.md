# ZCG Call Intelligence — Build Plan

## Sequence

| Phase | Name | Deliverable |
| --- | --- | --- |
| 0 | Architecture | This docs set + ADRs |
| 1 | Foundation | Monorepo, Docker, Prisma, auth, seed admin |
| 2 | Commercial graph | Publishers, buyers, campaigns, numbers, verticals |
| 3 | Telephony | Provider interface + Fake + carrier stubs |
| 4 | Inbound engine | Call + events + idempotent callbacks |
| 5 | Routing | Package + waterfall + simulator |
| 6 | Billing | Duration conversions + P&L |
| 7 | Reporting | Dashboard, log, inspector, aggregates |
| 8 | RTB | Auctions (types in P0; live ping P1) |
| 9–12 | IVR / agents / AI / optimize | After MVP green |

After **every** phase: tests, lint, typecheck, migrate, README, commit.

## Current execution

This repository started empty (`README.md` placeholder only). The first implementation push completes **Phases 0–7 (MVP)** plus routing/billing unit tests and a runnable demo scenario harness.

## Phase exit checklist

1. `pnpm test`
2. Repair failures
3. `pnpm lint`
4. `pnpm typecheck`
5. Prisma migrate status
6. Docs updated
7. README updated
8. Git commit

## Local run (target)

```bash
cp .env.example .env
docker compose -f infrastructure/docker-compose.yml up --build
```

Services: Postgres 5432, Redis 6379, API 4000, Web 3000, Worker.

```bash
pnpm db:migrate
pnpm db:seed
```

Demo login comes from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (never hardcoded).
