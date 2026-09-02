import { isBuyerRole, isPublisherRole } from "./permissions.js";
import type { UserRole } from "./enums.js";
import { maskE164 } from "./pii.js";

export interface PortalViewer {
  role: UserRole;
  pii: boolean;
  publisherId?: string | null;
  buyerId?: string | null;
}

/** Strip buyer identity, destination, rate, and margin from publisher-facing payloads. */
export function redactForPublisher(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };
  next.buyer = undefined;
  next.buyerId = undefined;
  next.revenue = null;
  next.profit = null;
  next.margin = null;
  next.telecomCost = null;
  next.buyerRevenueAmount = null;
  next.estimatedTelecomCost = null;
  next.routingSnapshot = null;
  if (typeof next.routingExplanation === "string") {
    next.routingExplanation = "Routed to an eligible destination.";
  }
  if (Array.isArray(next.attempts)) {
    next.attempts = (next.attempts as Array<Record<string, unknown>>).map((a, i) => ({
      ...a,
      buyerName: `Destination ${i + 1}`,
      buyerId: null,
    }));
  }
  if (Array.isArray(next.auctions)) next.auctions = [];
  if (Array.isArray(next.buyers)) {
    next.buyers = (next.buyers as Array<Record<string, unknown>>).map((link, i) => ({
      ...link,
      buyer: { company: `Destination ${i + 1}` },
      revenueOverride: null,
    }));
  }
  return next;
}

/** Strip publisher payout, margin, and other buyers’ bids from buyer-facing payloads. */
export function redactForBuyer(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };
  next.payout = null;
  next.profit = null;
  next.margin = null;
  next.publisherPayoutAmount = null;
  if (next.publisher && typeof next.publisher === "object") {
    next.publisher = { company: "Publisher" };
  }
  if (Array.isArray(next.auctions)) {
    next.auctions = (next.auctions as Array<Record<string, unknown>>).map((a) => ({
      ...a,
      bids: Array.isArray(a.bids)
        ? (a.bids as Array<Record<string, unknown>>).filter((b) => b.winner)
        : [],
    }));
  }
  return next;
}

export function applyPortalRedaction<T extends Record<string, unknown>>(user: PortalViewer, row: T): T {
  let next: Record<string, unknown> = { ...row };
  if (!user.pii && typeof next.callerE164 === "string") {
    next.callerE164 = maskE164(next.callerE164);
  }
  if (isPublisherRole(user.role)) next = redactForPublisher(next);
  if (isBuyerRole(user.role)) next = redactForBuyer(next);
  return next as T;
}

export function redactKpis(user: PortalViewer, kpis: Record<string, unknown>): Record<string, unknown> {
  const next = { ...kpis };
  if (isPublisherRole(user.role)) {
    next.revenue = null;
    next.profit = null;
    next.margin = null;
    next.telecom = null;
    next.avgRevenuePerCall = null;
  }
  if (isBuyerRole(user.role)) {
    next.payout = null;
    next.profit = null;
    next.margin = null;
    next.avgPayoutPerCall = null;
  }
  return next;
}
