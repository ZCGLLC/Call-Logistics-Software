# Going live

ZCG CI can run the full commercial workflow (publishers, buyers, campaigns, DIDs, routing, conversions, invoices) in demo mode. **Public telephone calls** require a carrier.

## 1. Host the stack

```bash
cp .env.example .env
# set JWT_SECRET, SEED_ADMIN_PASSWORD, PUBLIC_BASE_URL, PUBLIC_HOST
# set TELEPHONY_PROVIDER=twilio (or telnyx) plus carrier keys

docker compose -f infrastructure/docker-compose.prod.yml up --build -d
pnpm db:migrate:deploy
pnpm db:seed   # first environment only
```

`APP_ENV=production` refuses `TELEPHONY_PROVIDER=fake` unless `ALLOW_FAKE_TELEPHONY=true`.

`PUBLIC_BASE_URL` must be the HTTPS origin carriers can reach, e.g. `https://ci.zaidiconsultinggroup.com`.

## 2. Carrier (Twilio or Telnyx)

### Twilio

1. Create a Twilio account and a Voice-capable project.
2. Set in `.env`:
   - `TELEPHONY_PROVIDER=twilio`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `PUBLIC_BASE_URL`
3. In Twilio, set the number (or the Messaging/Voice webhook) to:
   - Voice: `{PUBLIC_BASE_URL}/api/v1/telephony/twilio/inbound`
   - Status: `{PUBLIC_BASE_URL}/api/v1/telephony/twilio/status`
4. In ZCG CI **Numbers**, generate DIDs (this purchases via Twilio when the adapter is live) and assign them to a publisher/campaign.
5. Put each buyer’s true destination DID on the buyer record.
6. Call the tracking number. The inbound webhook routes, Dial TwiML bridges the buyer, and the status callback writes duration + conversion.

Signatures are verified with `X-Twilio-Signature`. Set `TELEPHONY_SKIP_SIGNATURE=true` only in local debugging.

### Telnyx

Set `TELEPHONY_PROVIDER=telnyx`, `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, optional `TELNYX_WEBHOOK_SECRET`. TeXML inbound: `{PUBLIC_BASE_URL}/api/v1/telephony/telnyx/inbound`. Call-control events: `{PUBLIC_BASE_URL}/api/v1/telephony/telnyx/events`.

## 3. Storage, email, payments

| Concern | Env | Behavior |
| --- | --- | --- |
| Recordings | `STORAGE_PROVIDER=fake\|s3\|carrier` | Live calls store the carrier recording URL; S3 path is recorded when configured |
| Email | `EMAIL_PROVIDER=console\|webhook` | `EMAIL_WEBHOOK_URL` for Postmark/Mailgun/SES HTTPS |
| Payments | invoices | Generate invoices, export CSV, **Mark paid** after ACH. Stripe is not required. |

## 4. Hardening

- Enable MFA under **Settings → Authenticator**
- Rotate `JWT_SECRET`; never commit `.env`
- Keep `COOKIE_SECURE=true` behind HTTPS
- Demo Command Center scenarios are disabled when `APP_ENV=production` unless `FEATURE_DEMO=true`

## 5. What this preview can and cannot do

The HTTPS preview URL serves the real UI/API. Without Twilio/Telnyx keys in the environment, generated DIDs stay on the **fake** inventory and Command Center simulations do not place PSTN calls. Paste carrier keys, restart API, then generate real numbers.
