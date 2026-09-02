# Load testing architecture (P1 gate, not merge-blocking)

Harness lives conceptually in `scripts/loadtest.ts` (k6 or autocannon).

Targets:

| Rate | What to watch |
| --- | --- |
| 10 cps | Routing p99, Redis INCR, call insert |
| 50 cps | Postgres WAL, webhook queue depth |
| 100 cps | Auction timeout behavior, connection pool |

Never block the live path on transcription or AI. Bottlenecks expected first: call-event inserts and cap counters. Batch events if p99 exceeds 100ms internal routing.
