# ZCG Call Intelligence — Product Specification

**Product name:** ZCG Call Intelligence  
**Internal short name:** ZCG CI  
**Owner:** Zaidi Consulting Group  
**Document status:** Phase 0 baseline

This specification is original to ZCG. It describes industry-standard pay-per-call, routing, and revenue-management concepts. It does not copy third-party product UI, copy, or proprietary implementations.

---

## 1. Problem

ZCG operates high-volume performance marketing across Medicare, ACA, Final Expense, Auto Insurance, and related verticals. Today that workflow depends on third-party call-tracking and routing vendors.

ZCG CI owns **business logic**: publisher/buyer relationships, routing, auctions, conversions, payouts, profit, compliance, and analytics. Commodity telephony (PSTN, DIDs, SIP trunks, minutes) remains replaceable infrastructure behind a provider interface.

---

## 2. Primary users

| Persona | Access |
| --- | --- |
| Super Admin | All tenants, platform configuration |
| Administrator | ZCG-managed organizations |
| Operations Manager | Command Center, live calls, routing, caps |
| Account Manager | Assigned publishers/buyers/campaigns |
| Finance | Invoices, statements, disputes, margin |
| Compliance | Suppression, consent, recordings, audit |
| Publisher Admin / User | Own publisher portal only |
| Buyer Admin / User | Own buyer portal only |
| Call Center Manager | Queues, agents, dispositions |
| Agent | Assigned inbound/outbound workstation |
| Read Only | Assigned reports |

---

## 3. Priority model

| Priority | Meaning |
| --- | --- |
| **P0** | Required for the first working MVP. No substitute workflow. |
| **P1** | Needed for production operations shortly after MVP. |
| **P2** | Competitive differentiators and operational leverage. |
| **P3** | Future / advanced. Architecture must not block these. |

---

## 4. P0 — MVP (must work)

The MVP is successful when the four simulated scenarios in §10 pass without real PSTN minutes.

### 4.1 Foundation

- Multi-tenant organizations with tenant isolation on every query
- Users, roles, permissions
- Login, logout, password hashing, session JWT, email-verification field, MFA-ready user columns
- Audit log for sensitive mutations
- Feature flags (platform + organization)
- Environment-based configuration (no secrets in git)
- Structured JSON logging with `call_id` correlation
- Docker Compose for web, API, worker, Postgres, Redis

### 4.2 Commercial objects

- Publishers (statuses, payout model, verticals, account manager)
- Buyers (destinations, caps, hours, rates, conversion rules)
- Verticals (seeded, admin-configurable; custom fields schema)
- Campaigns (publisher, buyers, numbers, routing strategy, conversion/payout rules, schedule)
- Tracking numbers (inventory, assignment, pools)
- Campaign duplicate + template flag

### 4.3 Call lifecycle

- Globally unique call ID
- Inbound call via `TelephonyProvider` (Fake adapter in demo mode)
- Caller geo from number / provided attributes
- Duplicate detection (configurable window + scope + action)
- Suppression check
- Routing engine (deterministic, explained)
- Waterfall attempts with timeouts
- Call event timeline (append-only)
- Duration-based conversion
- Revenue, payout, estimated telecom cost, gross profit, margin
- Idempotent completion webhooks

### 4.4 Routing (P0 strategies)

- Priority
- Weighted
- Highest revenue
- Highest bid
- Max gross profit

Filters: vertical, state, ZIP, hours, caps, publisher, campaign, traffic source, duplicate, suppression, min/max bid.

### 4.5 Financials (P0)

- Integer-cent / decimal-safe money (never IEEE-754 for ledger math)
- Duration conversion with independent publisher and buyer thresholds
- Duplicate conversion prevention
- Per-call financial snapshot
- Daily aggregates for dashboard KPIs

### 4.6 Surfaces

- Login
- Executive dashboard (today / MTD KPIs)
- Live calls table (poll + WebSocket)
- Call log + Call Inspector (timeline + routing explanation)
- Publisher / buyer / campaign / number CRUD
- Call Flow Simulator (no PSTN)
- Operations Matrix
- CSV export for calls
- Fake telephony simulator UI / API

### 4.7 Explicitly out of P0

AI, transcription QA, power dialer, graphical IVR builder, full RTB marketplace UI, invoicing PDF, ClickHouse, self-hosted SIP stack, ML routing.

---

## 5. P1 — Production operations

- Publisher portal and buyer portal (strict data hiding)
- API keys, public REST `/api/v1`, OpenAPI
- Lead ingestion API
- Webhook engine (HMAC, retry, DLQ)
- RTB ping/post (publisher + buyer bidder) with auction log
- Simultaneous ring
- Invoices and publisher statements (CSV; PDF later)
- Disputes with financial credit
- Caps in Redis with DB source of truth
- Recording metadata + object storage adapter (S3-compatible)
- Recording consent / disclosure settings
- Saved filters, tags, custom fields
- Alerts (in-app + email adapter)
- System health page
- Import CSV with preview
- GitHub Actions CI

---

## 6. P2 — Differentiators

- Command Center
- Routing Debugger (replay against snapshot)
- Expected-value routing
- Publisher / buyer health scores
- Call quality score (explainable, non-financial)
- Revenue Opportunity Finder
- Capacity dashboard
- Auction analytics
- Carrier cost analytics + provider failover
- Predictive rule-based scoring (not ML)
- Global search (Ctrl/Cmd+K)
- Notification center
- IVR JSON runtime (builder UI can follow)
- Agent control center (WebRTC architecture)
- Consent evidence store

---

## 7. P3 — Future

- Graphical IVR builder (React Flow)
- Power dialer with compliance pacing
- AI transcription / QA / fraud signals (advisory only)
- ML routing optimizer with deterministic fallback
- Scenario planner
- ClickHouse / BigQuery / Snowflake analytics adapter
- GenericSIPAdapter → Asterisk / FreeSWITCH / Kamailio / OpenSIPS
- Slack alert delivery
- PDF invoice rendering

---

## 8. Data hiding rules

- Publisher A never sees Publisher B.
- Publishers never see buyer identity, DID/SIP destination, buyer rate, or ZCG margin unless an explicit authorization flag is set on the campaign.
- Buyers never see publisher payout or other buyers' bids unless authorized.
- Restricted roles see masked phone numbers, e.g. `(214) ***-1234`.
- Super Admin / ZCG staff with PII permission see full numbers; access is audited.

---

## 9. Vertical workflow (P0 seed)

Optimize first screens around:

| Vertical | Typical conversion |
| --- | --- |
| Medicare | Duration (e.g. $42 / 90s) |
| ACA | Duration / qualified connect |
| Final Expense | Buffer model (e.g. $14 / 10s vs $10 / 10s) |
| Auto Insurance | Duration / state-priced |

Operations Matrix columns (P0): vertical, publisher, campaign, publisher rate, publisher buffer, buyer, buyer rate, buyer buffer, gross spread, states, cap, delivered today, remaining, DID, status.

---

## 10. MVP acceptance scenarios

### Scenario 1 — Highest revenue Medicare TX

1. Publisher A origin, campaign Medicare TX, caller state TX.
2. Buyer A: $35 / 90s, TX, under cap. Buyer B: $42 / 90s, TX, under cap.
3. Strategy `HIGHEST_REVENUE` selects Buyer B.
4. Fake telephony connects; talk time 130s.
5. Revenue $42.00, publisher payout $28.00, estimated telecom from config, profit = revenue − payout − telecom.
6. Dashboard, reports, and Call Inspector timeline all show the call.

### Scenario 2 — Buffer / duration threshold

- Publisher $10 / 10s, buyer $14 / 10s.
- 8s connected: **no conversion**, $0 revenue, $0 payout.
- 14s connected: converted, revenue $14, payout $10, profit calculated.

### Scenario 3 — Waterfall

- Buyer A $45 no-answer → Buyer B $40 reject → Buyer C $36 answer.
- All attempts logged; conversion applies to C if threshold met.

### Scenario 4 — RTB (P1, architecture in P0)

- Bids: A $32, B $45, C $39, D reject. Winner B; failover to C on connect failure.
- P0 ships auction types + FakeBidderAdapter; full marketplace is P1.

---

## 11. Milestones (GitHub-style)

| Milestone | Phase | Exit criteria |
| --- | --- | --- |
| M0 Architecture | 0 | Spec, architecture, ERD, contracts, ADRs |
| M1 Foundation | 1 | Auth, schema, migrations, seed admin, Compose |
| M2 Commercial graph | 2 | Publishers, buyers, campaigns, numbers |
| M3 Telephony | 3 | Provider interface + Fake + Twilio/Telnyx/Plivo stubs |
| M4 Inbound engine | 4 | Call create, events, idempotent webhooks |
| M5 Routing | 5 | Engine package + waterfall + simulator |
| M6 Billing | 6 | Conversions, money, profit, no double convert |
| M7 Reporting | 7 | Dashboard, call log, inspector, aggregates |
| M8 RTB | 8 | Ping/post, auctions, timeouts |
| M9 IVR | 9 | Versioned JSON runtime + builder later |
| M10 Contact center | 10 | Agent states, WebRTC adapter |
| M11 AI/QA | 11 | STT + advisory scoring |
| M12 Optimization | 12 | Health scores, opportunity finder, ML hook |

---

## 12. Non-goals

- Recreating the public telephone network
- Hard-coding a single carrier
- Automatically applying AI to irreversible financial decisions
- Aggressive outbound dialing without compliance controls
- Cloning any competitor's UI, branding, or copy
