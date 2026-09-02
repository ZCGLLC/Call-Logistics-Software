# ZCG Call Intelligence

Proprietary pay-per-call, routing, and revenue platform for **Zaidi Consulting Group**.

This is an original product (internal short name **ZCG CI**). It is not a clone of any third-party call-tracking vendor.

## What this repo is

A TypeScript monorepo:

| Path | Role |
| --- | --- |
| `apps/web` | Next.js operations UI (Aperture design system) |
| `apps/api` | NestJS REST + Socket.IO + inbound call engine |
| `apps/worker` | BullMQ processors |
| `packages/routing-engine` | Pure, deterministic routing |
| `packages/billing` | Duration conversions & P&L (decimal.js) |
| `packages/telephony` | Carrier interface + Fake adapter |
| `packages/database` | Prisma / PostgreSQL |
| `docs/` | Architecture, ERD, contracts |

MVP covers auth, publishers, buyers, campaigns, numbers, fake telephony, routing (including waterfall), duration conversions, dashboards, call inspector, operations matrix, and call-flow simulator.

## Local run

```bash
cp .env.example .env
# set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, JWT_SECRET

docker compose -f infrastructure/docker-compose.yml up postgres redis -d
pnpm install
pnpm db:generate
pnpm --filter @zcg/database exec prisma migrate dev --name init
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000  
- API: http://localhost:4000/api/v1  
- OpenAPI (non-prod): http://localhost:4000/api/docs  

Login with the seeded admin credentials from `.env`.

Without Docker, point `DATABASE_URL` / `REDIS_URL` at local Postgres 16 and Redis 7.

## Demo without buying minutes

`TELEPHONY_PROVIDER=fake` (default). From Command Center, run MVP scenarios, or:

```bash
curl -X POST http://localhost:4000/api/v1/demo/mvp-scenarios \
  --cookie "zcg_session=..." 
```

Scenario 1: Medicare TX, highest revenue → Buyer B $42, 130s connected → converted.  
Scenario 2: Final Expense $14 / $10 @ 10s — 8s no conversion, 14s converted.  
Scenario 3: Waterfall no-answer → reject → answer.  
Scenario 4: In-process RTB, winner B $45.

## Tests

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Routing and billing tests are merge-critical.

## Documentation

Start with `docs/PRODUCT_SPEC.md` and `docs/ARCHITECTURE.md`.

## License

Proprietary. All rights reserved — Zaidi Consulting Group.
