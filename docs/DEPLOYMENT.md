# Deployment

## Environments

`local` | `test` | `staging` | `production`

Never point local/test at production credentials or production Redis/Postgres.

## Docker Compose (local)

See `infrastructure/docker-compose.yml`.

```bash
cp .env.example .env
docker compose -f infrastructure/docker-compose.yml up --build
pnpm db:migrate
pnpm db:seed
```

## Production sketch

- API + worker: 12-factor Node on ECS/Cloud Run/K8s
- Web: Next.js standalone or behind the same TLS terminator
- Postgres: managed (PITR enabled)
- Redis: managed, persistence optional (caps are rebuilt)
- Object storage: S3-compatible bucket, SSE-S3 or SSE-KMS
- Secrets: platform secret manager
- Observability: OTLP exporter to vendor of choice

## Backups

| Asset | Policy |
| --- | --- |
| Postgres | Daily snapshot + WAL PITR (goal: 5-minute RPO) |
| Recordings | Bucket versioning + lifecycle per campaign retention |
| Secrets | Dual-region secret replica; documented recovery runbook |
| DR | Warm standby Postgres (P2); RTO target documented by ops, not in app code |

## Health

- `GET /health/live` process up
- `GET /health/ready` Postgres + Redis ping
- UI System Health (P1) reads the same probes + queue depth
