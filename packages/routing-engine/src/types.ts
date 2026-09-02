import { Money } from "@zcg/shared";
import type { RoutingStrategy } from "@zcg/shared";

export interface MoneyLike {
  toString(): string;
}

export interface HoursWindow {
  timezone: string;
  /** 0=Sun … 6=Sat. Empty = every day. */
  days: number[];
  openMinutes: number;
  closeMinutes: number;
  holidays: string[];
  blackoutDates: string[];
  /** If set, overrides weekly hours for this instant. */
  temporaryClosed?: boolean;
  temporaryOpen?: boolean;
}

export interface CapUsage {
  concurrent: number;
  concurrentLimit: number | null;
  hourly: number;
  hourlyLimit: number | null;
  daily: number;
  dailyLimit: number | null;
  weekly: number;
  weeklyLimit: number | null;
  monthly: number;
  monthlyLimit: number | null;
}

export interface DestinationSnapshot {
  id: string;
  buyerId: string;
  buyerName: string;
  destinationId: string;
  destinationLabel: string;
  did?: string;
  sipUri?: string;
  active: boolean;
  verticalId: string;
  allowedStates: string[];
  allowedZips: string[];
  allowedAreaCodes: string[];
  allowedPublisherIds: string[];
  allowedCampaignIds: string[];
  allowedTrafficSourceIds: string[];
  hours: HoursWindow | null;
  caps: CapUsage;
  bid: Money;
  revenue: Money;
  payout: Money;
  estimatedTelecom: Money;
  conversionProbability: number;
  epc: Money;
  conversionRate: number;
  answerRate: number;
  priority: number;
  weight: number;
  lastConnectedAt: string | null;
  utilization: number;
  minBid: Money | null;
  maxBid: Money | null;
  ivrPredicates: Record<string, unknown>;
}

export interface RoutingCall {
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
  duplicateAction: "REJECT" | "ROUTE_ELSEWHERE" | "LOWER_PRICE" | "FLAG_ONLY";
  isSuppressed: boolean;
  previousBuyerId?: string;
}

export interface RoutingCampaign {
  id: string;
  verticalId: string;
  routingStrategy: RoutingStrategy;
  timezone: string;
  allowedStates?: string[];
}

export interface RoutingSnapshot {
  now: Date;
  call: RoutingCall;
  campaign: RoutingCampaign;
  estimatedTelecomCost: Money;
  publisherPayout: Money;
  destinations: DestinationSnapshot[];
}

export interface DecisionTrace {
  destinationId: string;
  buyerName: string;
  rule: string;
  input: string;
  expected: string;
  pass: boolean;
}

export interface RankedDestination {
  destination: DestinationSnapshot;
  score: string;
  rank: number;
  expectedGrossProfit: Money;
  expectedValue: Money;
}

export interface RejectedDestination {
  destination: DestinationSnapshot;
  reasons: string[];
}

export interface RoutingResult {
  eligible: RankedDestination[];
  rejected: RejectedDestination[];
  selected?: RankedDestination;
  strategy: RoutingStrategy;
  explanation: string;
  traces: DecisionTrace[];
}
