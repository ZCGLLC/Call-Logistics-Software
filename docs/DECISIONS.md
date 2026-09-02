# Architecture Decision Records

## ADR-001: NestJS API + Next.js web (not a single Next monolith)

**Status:** Accepted  
**Context:** The product is a routing/financial system with webhooks, WebSockets, and workers. A single Next.js app can host this, but inbound telephony and sub-100ms routing benefit from a dedicated NestJS process with explicit modules and a separate worker.  
**Decision:** `apps/api` (NestJS) owns business logic, `apps/web` (Next.js) owns UI, `apps/worker` owns async jobs. Shared domain lives in `packages/*`.  
**Consequences:** Two Node servers locally; Compose wires them. OpenAPI is generated from NestJS.

## ADR-002: Money as DECIMAL(19,4) + decimal.js

**Status:** Accepted  
**Context:** IEEE-754 cannot represent 0.01. Telecom costs need sub-cent precision.  
**Decision:** Persist `Decimal(19,4)` dollars. All arithmetic in `Money` (`decimal.js`). Display layer may format; it never computes P&L.  
**Consequences:** JSON APIs serialize money as strings (`"42.0000"`).

## ADR-003: Pure routing engine

**Status:** Accepted  
**Context:** Routing must be deterministic, unit-testable, and explainable.  
**Decision:** `packages/routing-engine` has no I/O. API builds a `RoutingSnapshot` (including Redis cap reads) and persists the explanation.  
**Consequences:** Snapshot builder is the integration surface; engine tests do not need Postgres.

## ADR-004: Fake telephony is a first-class adapter

**Status:** Accepted  
**Context:** ZCG must test conversion, waterfall, and dashboards without buying minutes.  
**Decision:** `FakeTelephonyProvider` implements the same interface as Twilio/Telnyx/Plivo. Demo/dev default `TELEPHONY_PROVIDER=fake`.  
**Consequences:** Production misconfiguration of `fake` is a launch blocker; env + health check surface the active adapter.

## ADR-005: One conversion per call in MVP

**Status:** Accepted  
**Context:** Duration PPC is the core ZCG model.  
**Decision:** Unique conversion on `callId`. Disputes in P1 create adjustment ledger rows, not silent overwrites.  
**Consequences:** Revenue-share / multi-event conversions wait for P1 schema (`Conversion.kind`).

## ADR-006: Caps — Redis hot path, Postgres authority

**Status:** Accepted  
**Decision:** INCR/EXPIRE in Redis during routing; Postgres `CapPolicy` + periodic reconcile. On Redis loss, fail closed for capped buyers (configurable fail-open for demo).  
**Consequences:** Need reconcile worker (P1); MVP still writes attempt counts to Postgres.

## ADR-007: JWT in httpOnly cookie + Bearer for APIs

**Status:** Accepted  
**Context:** Browser dashboard + publisher/buyer machine APIs.  
**Decision:** Cookie session for web; `Authorization: Bearer` and `X-Api-Key` for programmatic access.  
**Consequences:** CSRF protection on cookie-mutating routes.

## ADR-008: No ML in routing v1

**Status:** Accepted  
**Decision:** Rule-based scores (`EXPECTED_VALUE`, `PREDICTIVE_SCORE` weights) with persisted score breakdown. Interface `ScoringModel` can later wrap an ML service. Deterministic fallback always available.

## ADR-009: IVR stored as versioned JSON

**Status:** Accepted  
**Decision:** Never mutate a published IVR graph in place. `IvrDefinition.version` + `status=published|draft`. Runtime executes published document only.

## ADR-010: Original UI system

**Status:** Accepted  
**Decision:** “Aperture” design system — graphite/ink surfaces, signal-green profit, copper loss, IBM Plex + Geist. Not a clone of any vendor dashboard.
