# Routing Engine Contract

Package: `@zcg/routing-engine`

## Input

```ts
interface RoutingSnapshot {
  now: Date;                     // UTC instant used for hours (never server TZ)
  call: {
    id: string;
    callerE164: string;
    state?: string;
    zip?: string;
    areaCode?: string;
    attributes: Record<string, unknown>;
    ivr: Record<string, unknown>;
    publisherId: string;
    campaignId: string;
    trafficSourceId?: string;
    isDuplicate: boolean;
    isSuppressed: boolean;
  };
  campaign: {
    id: string;
    verticalId: string;
    routingStrategy: RoutingStrategy;
    timezone: string;            // IANA
    allowedStates?: string[];
  };
  estimatedTelecomCost: Money;   // per connected call estimate
  publisherPayout: Money;        // expected payout if converted (or rate card)
  destinations: DestinationSnapshot[];
}
```

## Destination snapshot

Hours, caps, filters, bid/revenue, conversion threshold, priority, weight, EPC, answer rate, conversion rate — all precomputed by the API so the engine stays pure.

## Output

```ts
interface RoutingResult {
  eligible: RankedDestination[];
  rejected: RejectedDestination[];
  selected?: RankedDestination;
  strategy: RoutingStrategy;
  explanation: string;           // human-readable paragraph
  traces: DecisionTrace[];       // debugger rows
}
```

Example explanation:

```
Buyer A rejected: daily cap reached
Buyer B rejected: TX not accepted
Buyer C accepted: open, TX accepted, under cap, bid $42.00
Selected Buyer C because highest eligible revenue.
```

## Strategies (P0)

| Strategy | Rank key |
| --- | --- |
| `PRIORITY` | Lower `priority` value first (1 = highest) |
| `WEIGHTED` | Weighted random among eligible (deterministic with seed) |
| `HIGHEST_REVENUE` | Buyer revenue DESC |
| `HIGHEST_BID` | Bid DESC (falls back to revenue) |
| `MAX_GROSS_PROFIT` | revenue − payout − telecom DESC |
| `ROUND_ROBIN` | Least recent connect among eligible |
| `LEAST_UTILIZED` | Lowest cap utilization |
| `HIGHEST_EPC` | Historical EPC |
| `HIGHEST_CONVERSION` | Historical conversion rate |
| `PREDICTIVE_SCORE` | Weighted rule score |
| `EXPECTED_VALUE` | P(convert) × revenue − payout − telecom |

Weighted random is seeded by `call.id` so replays match.

## Filters (order)

1. Destination inactive / campaign not attached  
2. Suppressed / duplicate action = reject  
3. Vertical mismatch  
4. State / ZIP / area code  
5. Publisher / traffic source allow-list  
6. IVR / custom token predicates  
7. Business hours (destination timezone)  
8. Concurrent / hourly / daily / weekly / monthly caps  
9. Min/max bid  
10. Duplicate action `ROUTE_ELSEWHERE` may exclude prior buyer  

Each filter appends a trace `{ rule, input, expected, pass }`.

## Waterfall

Engine returns **ordered eligible list**. Executor dials in order with `dialTimeoutMs`, `retryDelayMs`, `maxAttempts`. Results write `RoutingAttempt`. Simultaneous ring is a separate executor mode (`SIMULTANEOUS`) that still uses the same eligibility list.

## Debugger

`explain(snapshot)` is identical to production `route(snapshot)`. Call Inspector stores the snapshot JSON (PII-redacted option) so an admin can replay.
