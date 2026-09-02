import { Money } from "@zcg/shared";
import type { DestinationSnapshot, RoutingSnapshot } from "./types.js";

const emptyCaps = {
  concurrent: 0,
  concurrentLimit: null as number | null,
  hourly: 0,
  hourlyLimit: null as number | null,
  daily: 0,
  dailyLimit: null as number | null,
  weekly: 0,
  weeklyLimit: null as number | null,
  monthly: 0,
  monthlyLimit: null as number | null,
};

export function dest(
  overrides: Partial<DestinationSnapshot> & Pick<DestinationSnapshot, "id" | "buyerId" | "buyerName">,
): DestinationSnapshot {
  return {
    destinationId: overrides.destinationId ?? `dst_${overrides.id}`,
    destinationLabel: overrides.destinationLabel ?? overrides.buyerName,
    active: true,
    verticalId: "vert_medicare",
    allowedStates: ["TX"],
    allowedZips: [],
    allowedAreaCodes: [],
    allowedPublisherIds: [],
    allowedCampaignIds: [],
    allowedTrafficSourceIds: [],
    hours: null,
    caps: { ...emptyCaps },
    bid: Money.from("35"),
    revenue: Money.from("35"),
    payout: Money.from("28"),
    estimatedTelecom: Money.from("0.04"),
    conversionProbability: 0.8,
    epc: Money.from("28"),
    conversionRate: 0.7,
    answerRate: 0.85,
    priority: 10,
    weight: 1,
    lastConnectedAt: null,
    utilization: 0.1,
    minBid: null,
    maxBid: null,
    ivrPredicates: {},
    ...overrides,
  };
}

export function snapshot(
  destinations: DestinationSnapshot[],
  overrides: Partial<RoutingSnapshot> = {},
): RoutingSnapshot {
  return {
    now: new Date("2026-03-15T16:00:00.000Z"),
    call: {
      id: "call_test1aaaaaa",
      callerE164: "+12145551234",
      state: "TX",
      zip: "75201",
      areaCode: "214",
      attributes: {},
      ivr: {},
      publisherId: "pub_a",
      campaignId: "cam_med_tx",
      isDuplicate: false,
      duplicateAction: "FLAG_ONLY",
      isSuppressed: false,
    },
    campaign: {
      id: "cam_med_tx",
      verticalId: "vert_medicare",
      routingStrategy: "HIGHEST_REVENUE",
      timezone: "America/Chicago",
    },
    estimatedTelecomCost: Money.from("0.04"),
    publisherPayout: Money.from("28"),
    destinations,
    ...overrides,
  };
}
