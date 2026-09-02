# Public API

Base path: `/api/v1`

Auth: `Authorization: Bearer <jwt>` or `X-Api-Key: zcg_…`

OpenAPI is generated at `/api/docs` in non-production.

## P0 resources (session auth)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Cookie session |
| POST | `/auth/logout` | Clear cookie |
| GET | `/auth/me` | Current principal |
| GET/POST | `/publishers` | List/create |
| GET/PATCH | `/publishers/:id` | Detail |
| GET/POST | `/buyers` | List/create |
| GET/PATCH | `/buyers/:id` | Detail |
| GET/POST | `/campaigns` | List/create |
| POST | `/campaigns/:id/duplicate` | Clone |
| GET/POST | `/numbers` | Inventory |
| GET | `/calls` | Search |
| GET | `/calls/:id` | Inspector |
| POST | `/routing/simulate` | Call Flow Simulator |
| GET | `/reports/kpis` | Dashboard |
| POST | `/demo/inbound` | Fake inbound (dev/demo) |
| GET | `/demo/mvp-scenarios` | Run packaged acceptance tests (dev) |

## P1

`/leads`, `/rtb/ping`, `/rtb/post`, `/conversions`, `/auctions`, `/invoices`, `/webhooks`, API key CRUD.

Idempotency: header `Idempotency-Key` on POSTs that create calls, conversions, or invoices.
