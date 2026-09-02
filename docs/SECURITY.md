# Security

## Controls (MVP+)

| Control | Implementation |
| --- | --- |
| Password hashing | argon2id (fallback bcrypt) |
| Sessions | JWT, httpOnly, Secure, SameSite=Lax, short TTL + rotation field |
| MFA | `User.mfaSecret` + `mfaEnabled`; enrollment UI P1 |
| CSRF | Origin check + cookie routes |
| Validation | Zod on all inputs |
| SQLi | Prisma only |
| XSS | React default escaping; CSP header |
| Rate limit | `@nestjs/throttler` + Redis |
| API keys | Hashed at rest (`sha256`), prefix `zcg_live_` / `zcg_test_`, scopes, rotation |
| Webhooks out | HMAC-SHA256 `X-ZCG-Signature` |
| Webhooks in | Idempotency + signature per adapter |
| Secrets | env / secret manager; `.env` gitignored |
| PII | `pii:read` permission; mask helper |
| Audit | Immutable insert-only API |
| TLS | Required in production (`docs/DEPLOYMENT.md`) |

## Roles and PII

Masked default: national significant number with last 4 visible. Full E.164 requires `pii:read`. Call recordings require `recordings:listen` plus campaign consent flags.

## Trust boundaries

- Buyer bid JSON is untrusted.
- Publisher lead posts are untrusted (E.164 normalize, rate limit, consent required flag).
- Never compute financials only on the client.

## OWASP

Follow ASVS L2 intent for auth, session, access control, and crypto. Dependency scanning in CI (P1).
