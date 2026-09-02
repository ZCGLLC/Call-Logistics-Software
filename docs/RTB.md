# Real-Time Bidding

Package: `@zcg/rtb`

## Flow

```
Inbound attributes
  → eligible static + dynamic buyers (routing filters)
  → parallel PING (timeout 500–3000 ms, default 1200)
  → validate responses (never trust)
  → rank (highest bid / max gross profit)
  → POST winner
  → route / waterfall on POST or connect failure
```

A slow bidder cannot block others: `Promise.race` per buyer with AbortController.

## Ping response (accepted subset)

```json
{
  "accept": true,
  "bid": "42.00",
  "buyer_ref": "ext-123",
  "destination": "+18005550199",
  "sip": "sip:queue@buyer.example",
  "expires_in": 30,
  "metadata": {}
}
```

Rejected if: bid missing/NaN/negative, destination not E.164/SIP, bid above campaign ceiling, buyer not eligible, signature invalid.

## Persistence

`Auction` + `Bid` rows. Metrics: win rate, spread, fill, latency.

## Publisher-facing RTB (P1)

`POST /api/v1/rtb/ping` and `POST /api/v1/rtb/post` authenticated with publisher API keys.

## MVP

Types, FakeBidder, and auction tables ship in P0. Live HTTP bidders are P1. Scenario 4 is executable via FakeBidder in-process.
