# ZCG Call Intelligence — Database

PostgreSQL 16. Prisma is the schema owner. Money uses `DECIMAL(19,4)`. Timestamps are `TIMESTAMPTZ` stored in UTC.

## 1. Conventions

| Rule | Implementation |
| --- | --- |
| Primary keys | `cuid()` strings |
| Public IDs | Prefixed human IDs (`pub_`, `buy_`, `cam_`, `call_`, `auc_`) |
| Money | `Decimal(19,4)` — dollars with 4 places (tenth of a mill) |
| Duration | integer **seconds** |
| Tenant column | `organizationId` on owned entities |
| Soft delete | `deletedAt` where recovery matters |
| Append-only | `CallEvent`, `AuditLog`, `ConsentRecord` — no update/delete APIs |
| Indexes | time, caller hash, campaign, publisher, buyer, status, conversion |

Sensitive phone numbers may additionally be stored encrypted at rest (application envelope) in P1; MVP stores E.164 and enforces **display masking** + PII permission.

## 2. ERD (MVP + forward tables)

```mermaid
erDiagram
  Organization ||--o{ User : has
  Organization ||--o{ Membership : has
  Organization ||--o{ Team : has
  Organization ||--o{ Publisher : owns
  Organization ||--o{ Buyer : owns
  Organization ||--o{ Campaign : owns
  Organization ||--o{ Vertical : owns
  Organization ||--o{ TrackingNumber : owns
  Organization ||--o{ Call : owns
  Organization ||--o{ Lead : owns
  Organization ||--o{ Invoice : owns
  Organization ||--o{ Statement : owns
  Organization ||--o{ WebhookEndpoint : owns
  Organization ||--o{ AuditLog : writes
  Organization ||--o{ FeatureFlag : sets

  User ||--o{ Membership : joins
  User ||--o{ Session : has
  User ||--o{ AuditLog : actor

  Publisher ||--o{ Campaign : supplies
  Publisher ||--o{ TrackingNumber : assigned
  Publisher ||--o{ Call : originates
  Publisher ||--o{ Statement : billed

  Buyer ||--o{ BuyerDestination : has
  Buyer ||--o{ CampaignBuyer : joins
  Buyer ||--o{ Call : receives
  Buyer ||--o{ Invoice : billed
  Buyer ||--o{ Bid : places

  Vertical ||--o{ Campaign : classifies
  Vertical ||--o{ CustomFieldDef : defines

  Campaign ||--o{ TrackingNumber : uses
  Campaign ||--o{ CampaignBuyer : includes
  Campaign ||--o{ Call : receives
  Campaign ||--o{ PricingRule : prices
  Campaign ||--o{ CapPolicy : limits
  Campaign ||--o{ Schedule : hours

  TrackingNumber }o--o{ NumberPool : member

  Call ||--o{ CallEvent : timeline
  Call ||--o{ RoutingAttempt : tries
  Call ||--o{ Auction : may_have
  Call ||--o{ Conversion : may_have
  Call ||--o{ Recording : may_have
  Call ||--o{ Transcript : may_have
  Call ||--o{ Dispute : may_have
  Call }o--o{ Lead : linked

  Auction ||--o{ Bid : collects

  Invoice ||--o{ InvoiceLine : lines
```

## 3. Table notes

### Organization / User / Membership / Role

RBAC is **role + permission grants**. Built-in roles map to a permission set in code (`packages/shared`). Custom extra grants are rows on `MembershipPermission`.

### Publisher / Buyer

Buyers have many `BuyerDestination` (DID or SIP). Hours live on `Schedule` (timezone IANA, day-of-week, open/close, holidays, blackouts, temporary override). Never use the API server timezone.

### CampaignBuyer

Join table: buyer, priority, weight, campaign-specific rate override, allowed states, conversion override.

### Call

Financial columns are snapshotted at conversion/completion so historical P&L does not change if a rate card is edited later. Rate-card edits are audited.

### CallEvent

Append-only. `seq` monotonic per call. Payload JSON. Used by Inspector and Routing Debugger.

### RoutingAttempt

One row per dial/ping: destination, result (`NO_ANSWER`, `REJECTED`, `BUSY`, `ANSWERED`, `FAILED`, `CANCELLED`), explanation, timings.

### Conversion

Unique `(callId)` for MVP duration model (one billable conversion per call). P1 may add adjustment conversions with `parentConversionId`.

### Cap counters

`CapPolicy` in Postgres; live increment in Redis key `cap:{scope}:{id}:{window}`. Reconcile job hourly.

## 4. Index plan (P0)

- `Call(organizationId, startedAt DESC)`
- `Call(callerNumber, startedAt)`
- `Call(campaignId, startedAt)`
- `Call(publisherId, startedAt)`
- `Call(buyerId, startedAt)`
- `Call(status, startedAt)`
- `Call(convertedAt)` where converted
- `CallEvent(callId, seq)`
- `TrackingNumber(e164)` unique
- `Lead(phone, campaignId)`
- `Auction(callId)`
- `AuditLog(organizationId, createdAt)`

## 5. Migrations

- Prisma migrate is the only schema path.
- `prisma migrate diff` in CI.
- Never edit applied migration files.

## 6. Backups (ops contract)

Documented in `docs/DEPLOYMENT.md`: daily snapshots + WAL PITR for Postgres, versioned object-storage for recordings, encrypted secret store for recovery. Not implemented as code in P0.
