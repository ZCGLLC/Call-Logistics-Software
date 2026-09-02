# Testing

## Layers

1. **Unit** — routing filters/strategies, `Money`, duration conversion, waterfall ordering (Vitest).
2. **Integration** — Prisma + testcontainers or docker Postgres; inbound call + conversion (P1 if no Docker in CI).
3. **API** — NestJS testing module with Fake telephony.
4. **E2E** — Playwright against Compose (P1).
5. **Load** — `scripts/loadtest.ts` documents 10/50/100 cps architecture; not a merge gate in P0.

## Mission-critical cases (must pass)

- Buyer closed → excluded
- Buyer capped → excluded
- Wrong state → excluded
- Higher bid/revenue wins
- Higher priority wins
- Weighted distribution is deterministic for a seed
- Duplicate blocked
- Waterfall proceeds no-answer → reject → answer
- Conversion fires at threshold, not before
- Publisher payout and margin match integer math
- Completion webhook delivered 3× → one conversion

## Demo scenarios

`pnpm demo:mvp` (or `POST /api/v1/demo/mvp-scenarios` in development) executes product spec §10 scenarios 1–3 (and 4 via FakeBidder).
