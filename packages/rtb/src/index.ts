import { Money } from "@zcg/shared";

export interface PingRequest {
  auctionId: string;
  vertical: string;
  state?: string;
  zip?: string;
  attributes: Record<string, unknown>;
}

export interface PingResponse {
  accept: boolean;
  bid?: string;
  buyerRef?: string;
  destination?: string;
  sip?: string;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

export interface ValidatedBid {
  buyerId: string;
  buyerName: string;
  accepted: boolean;
  bid: Money | null;
  destination?: string;
  sip?: string;
  latencyMs: number;
  rejectionReason?: string;
  raw: unknown;
}

export function validateBidResponse(input: {
  buyerId: string;
  buyerName: string;
  raw: unknown;
  latencyMs: number;
  timeoutMs: number;
  maxBid?: Money;
}): ValidatedBid {
  if (input.latencyMs > input.timeoutMs) {
    return {
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      accepted: false,
      bid: null,
      latencyMs: input.latencyMs,
      rejectionReason: "timeout",
      raw: input.raw,
    };
  }
  const r = input.raw as PingResponse | null;
  if (!r || typeof r !== "object") {
    return {
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      accepted: false,
      bid: null,
      latencyMs: input.latencyMs,
      rejectionReason: "invalid payload",
      raw: input.raw,
    };
  }
  if (!r.accept) {
    return {
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      accepted: false,
      bid: null,
      latencyMs: input.latencyMs,
      rejectionReason: "buyer rejected",
      raw: input.raw,
    };
  }
  const bid = Money.tryFrom(r.bid ?? "");
  if (!bid || bid.isNegative() || bid.isZero()) {
    return {
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      accepted: false,
      bid: null,
      latencyMs: input.latencyMs,
      rejectionReason: "invalid bid",
      raw: input.raw,
    };
  }
  if (input.maxBid && bid.gt(input.maxBid)) {
    return {
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      accepted: false,
      bid,
      latencyMs: input.latencyMs,
      rejectionReason: "bid above campaign ceiling",
      raw: input.raw,
    };
  }
  if (!r.destination && !r.sip) {
    return {
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      accepted: false,
      bid,
      latencyMs: input.latencyMs,
      rejectionReason: "missing destination",
      raw: input.raw,
    };
  }
  return {
    buyerId: input.buyerId,
    buyerName: input.buyerName,
    accepted: true,
    bid,
    destination: r.destination,
    sip: r.sip,
    latencyMs: input.latencyMs,
    raw: input.raw,
  };
}

export function selectWinner(bids: ValidatedBid[]): ValidatedBid | undefined {
  const accepted = bids.filter((b) => b.accepted && b.bid);
  accepted.sort((a, b) => b.bid!.cmp(a.bid!));
  return accepted[0];
}

export interface FakeBidder {
  buyerId: string;
  buyerName: string;
  response: PingResponse;
  latencyMs: number;
}

export function runFakeAuction(bidders: FakeBidder[], timeoutMs = 1200): ValidatedBid[] {
  return bidders.map((b) =>
    validateBidResponse({
      buyerId: b.buyerId,
      buyerName: b.buyerName,
      raw: b.response,
      latencyMs: b.latencyMs,
      timeoutMs,
    }),
  );
}
