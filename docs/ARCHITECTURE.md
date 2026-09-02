# ZCG Call Intelligence — Architecture

## 1. Chosen stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Shared types across web, API, worker, engines |
| Web | Next.js App Router + React + Tailwind + shadcn/ui | Desktop-first ops UI, RSC where useful |
| API | NestJS | Modular providers, guards, OpenAPI, WS gateway |
| Worker | NestJS + BullMQ | Same modules as API; no live-path blocking |
| Database | PostgreSQL 16 + Prisma | Source of truth, NUMERIC money, row-level tenant filters |
| Cache / caps | Redis 7 | Realtime cap counters; DB remains authoritative |
| Realtime | Socket.IO | Live calls, auctions, cap updates |
| Auth | NestJS JWT (httpOnly cookie + Bearer) + API keys | MFA-ready columns; Auth.js-compatible later |
| Money | `decimal.js` + Prisma `Decimal(19,4)` | No IEEE-754 ledger math |
| Tests | Vitest (unit/integration) + Playwright (e2e later) | Routing/finance are mission-critical |
| Observability | pino JSON + OpenTelemetry SDK hooks | `call_id` / `auction_id` / `routing_attempt_id` |

Carriers, SMS, email, object storage, STT, AI, enrichment, and payments are **interfaces**. Adapters are swappable.

## 2. Repository layout

```
apps/
  web/                 Next.js UI (port 3000)
  api/                 NestJS HTTP + WS + telephony callbacks (port 4000)
  worker/              BullMQ processors (transcription, webhooks, aggregates)
packages/
  database/            Prisma schema, client, tenant extension, seed
  shared/              IDs, money, enums, DTOs, feature flags
  routing-engine/      Pure functions: filter, rank, explain
  telephony/           TelephonyProvider + Fake/Twilio/Telnyx/Plivo/SIP stubs
  billing/             Conversion + P&L (decimal-safe)
  analytics/           KPI queries + future warehouse port
  rtb/                 Ping/post auction orchestration
  ivr/                 Versioned IVR JSON runtime
  compliance/          Suppression, duplicates, consent, recording policy
  ui/                  Shared design tokens + shadcn primitives
docs/
infrastructure/        compose, Caddy/nginx snippets
scripts/               seed, demo-call, load-test harness
tests/                 cross-package integration
```

## 3. Runtime topology

```
Publisher / Buyer / Staff browsers
        │
        ▼
   apps/web (Next.js)
        │  REST + cookie
        ▼
   apps/api (NestJS)
        │
        ├── packages/routing-engine  (in-process, <100ms target)
        ├── packages/billing
        ├── packages/rtb (bounded timeout, parallel bids)
        ├── packages/telephony → carrier OR FakeTelephonyProvider
        ├── PostgreSQL
        ├── Redis (caps, sessions, Socket.IO adapter, BullMQ)
        └── BullMQ → apps/worker
```

Live call path **must not** wait for AI, transcription, report rollups, or non-critical logging sinks.

## 4. Multi-tenancy

- Root entity: `Organization`.
- Organization kinds: `INTERNAL` (ZCG), `PUBLISHER`, `BUYER`, `CALL_CENTER`.
- Almost every business row has `organizationId`.
- Prisma client extension injects `WHERE organizationId = ?` unless the actor is Super Admin in an explicit platform scope.
- Cross-tenant joins (e.g. ZCG campaign linking a publisher org and buyer org) are modeled as **ZCG-owned** campaign rows with foreign keys, never by mixing publisher JWT into buyer queries.

## 5. Request identity

```
AuthGuard → RequestContext {
  userId, organizationId, role, permissions[],
  piiAccess, tenantScope: 'self' | 'platform'
}
```

API keys resolve to a service principal with scopes (`leads:write`, `rtb:ping`, `calls:read`, …).

## 6. Telephony boundary

All call control goes through `TelephonyProvider`. NestJS `TelephonyModule` selects an adapter from `TELEPHONY_PROVIDER` (`fake` | `twilio` | `telnyx` | `plivo` | `sip`).

Inbound:

1. Carrier (or Fake) HTTP webhook → idempotency key `(provider, providerCallId, eventType)`
2. `InboundCallService` loads number → campaign → publisher
3. Compliance + duplicate
4. Optional IVR runtime (P1/P9)
5. Routing engine
6. Optional RTB (bounded)
7. `bridgeCall` / waterfall
8. On hangup: billing (sync, transactional) then enqueue recording/webhooks

## 7. Routing contract

See `docs/ROUTING_ENGINE.md`. The engine is a **pure package**: no Prisma, no Redis, no HTTP. The API supplies a `RoutingSnapshot`. Output is ranked destinations plus a human-readable explanation tree persisted on the call.

## 8. Financial contract

See billing package. All writes that create conversions or adjust money run in a Postgres transaction with an idempotency key.

```
GrossProfit = BuyerRevenue - PublisherPayout - TelecomVariableCost - OtherVariableCost
Margin      = BuyerRevenue == 0 ? 0 : GrossProfit / BuyerRevenue
```

AI never posts ledger rows.

## 9. Realtime

Socket.IO rooms:

- `org:{organizationId}:live-calls`
- `org:{organizationId}:command-center`
- `call:{callId}` (inspector)

Events: `CALL_STARTED`, `CALL_ROUTING`, `CALL_CONNECTED`, `CALL_COMPLETED`, `CONVERSION_CREATED`, `CAP_UPDATED`, `AUCTION_COMPLETED`.

## 10. Failure and failover

- Telephony adapter errors map to `ProviderFailure`; routing can retry the next destination.
- `ProviderRouter` supports primary + secondary adapter (P2).
- Webhook delivery is at-least-once with idempotent consumers.

## 11. Security (summary)

Details in `docs/SECURITY.md`. Highlights: bcrypt/argon2id passwords, httpOnly JWT, CSRF on cookie POSTs, Zod validation, Prisma parameterized queries, rate limits, webhook HMAC, PII masking, audit log immutable from application APIs.

## 12. Analytics evolution

Postgres + hourly/daily aggregate tables for MVP. `AnalyticsStore` interface allows a later ClickHouse/BigQuery/Snowflake adapter without rewriting KPI definitions.
