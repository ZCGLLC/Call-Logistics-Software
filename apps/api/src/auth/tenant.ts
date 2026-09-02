import type { Prisma } from "@prisma/client";
import {
  applyPortalRedaction,
  isBuyerRole,
  isPublisherRole,
  redactKpis,
  type UserRole,
} from "@zcg/shared";
import type { AuthPrincipal } from "./auth.guard.js";

export function callScope(user: AuthPrincipal): Prisma.CallWhereInput {
  return {
    organizationId: user.organizationId,
    ...(user.publisherId ? { publisherId: user.publisherId } : {}),
    ...(user.buyerId ? { buyerId: user.buyerId } : {}),
  };
}

export function campaignScope(user: AuthPrincipal): Prisma.CampaignWhereInput {
  return {
    organizationId: user.organizationId,
    ...(user.publisherId ? { publisherId: user.publisherId } : {}),
    ...(user.buyerId ? { buyers: { some: { buyerId: user.buyerId } } } : {}),
  };
}

export function publisherScope(user: AuthPrincipal): Prisma.PublisherWhereInput {
  return {
    organizationId: user.organizationId,
    ...(user.publisherId ? { id: user.publisherId } : {}),
  };
}

export function buyerScope(user: AuthPrincipal): Prisma.BuyerWhereInput {
  return {
    organizationId: user.organizationId,
    ...(user.buyerId ? { id: user.buyerId } : {}),
  };
}

export function numberScope(user: AuthPrincipal): Prisma.TrackingNumberWhereInput {
  return {
    organizationId: user.organizationId,
    ...(user.publisherId ? { publisherId: user.publisherId } : {}),
    ...(user.buyerId ? { campaign: { buyers: { some: { buyerId: user.buyerId } } } } : {}),
  };
}

export function redactRecord<T extends Record<string, unknown>>(user: AuthPrincipal, row: T): T {
  return applyPortalRedaction(user, row);
}

export function redactList<T extends Record<string, unknown>>(user: AuthPrincipal, rows: T[]): T[] {
  return rows.map((r) => redactRecord(user, r));
}

export function redactKpiPayload(user: AuthPrincipal, kpis: Record<string, unknown>) {
  return redactKpis(user, kpis);
}

export function portalKind(role: UserRole): "internal" | "publisher" | "buyer" {
  if (isPublisherRole(role)) return "publisher";
  if (isBuyerRole(role)) return "buyer";
  return "internal";
}
