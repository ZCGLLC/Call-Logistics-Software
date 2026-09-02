import { Inject, Injectable } from "@nestjs/common";
import { Money, createPublicId } from "@zcg/shared";
import { pingHttpBidder, selectWinner, validateBidResponse, type ValidatedBid } from "@zcg/rtb";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";

@Injectable()
export class AuctionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async runBuyerAuction(input: {
    organizationId: string;
    campaignId: string;
    callId?: string;
    state?: string;
    zip?: string;
    attributes?: Record<string, unknown>;
  }) {
    const campaign = await this.prisma.campaign.findFirstOrThrow({
      where: { organizationId: input.organizationId, id: input.campaignId },
      include: { buyers: { include: { buyer: { include: { destinations: true } } } } },
    });
    const timeoutMs = 1200;
    const bids: ValidatedBid[] = [];
    for (const link of campaign.buyers.filter((l) => l.active)) {
      const buyer = link.buyer;
      const dest = buyer.destinations.find((d) => d.active) ?? buyer.destinations[0];
      const maxBid = Money.from(String(link.revenueOverride ?? buyer.revenuePerCall ?? campaign.buyerRevenueAmount));
      if (buyer.pingEndpoint) {
        bids.push(
          await pingHttpBidder(
            {
              buyerId: buyer.id,
              buyerName: buyer.company,
              url: buyer.pingEndpoint,
              timeoutMs: buyer.timeoutMs || timeoutMs,
              maxBid,
            },
            {
              campaign: campaign.publicId,
              state: input.state,
              zip: input.zip,
              attributes: input.attributes ?? {},
            },
          ),
        );
      } else {
        const start = Date.now();
        bids.push(
          validateBidResponse({
            buyerId: buyer.id,
            buyerName: buyer.company,
            raw: {
              accept: buyer.status === "ACTIVE",
              bid: maxBid.toFixed(4),
              destination: dest?.did ?? dest?.sipUri,
            },
            latencyMs: Date.now() - start,
            timeoutMs,
            maxBid,
          }),
        );
      }
    }
    const winner = selectWinner(bids);
    let auctionId: string | null = null;
    if (input.callId) {
      const auction = await this.prisma.auction.create({
        data: {
          publicId: createPublicId("auc"),
          callId: input.callId,
          latencyMs: Math.max(0, ...bids.map((b) => b.latencyMs)),
          bids: {
            create: bids.map((b) => ({
              publicId: createPublicId("bid"),
              buyerId: b.buyerId,
              amount: b.bid ? b.bid.toFixed(4) : null,
              accepted: b.accepted,
              rejectionReason: b.rejectionReason,
              latencyMs: b.latencyMs,
              destination: b.destination ?? b.sip,
              winner: winner?.buyerId === b.buyerId,
            })),
          },
        },
      });
      auctionId = auction.id;
    }
    return { campaign, bids, winner, auctionId };
  }

  async storePing(payload: Record<string, unknown>) {
    const pingId = createPublicId("ping");
    await this.prisma.idempotencyRecord.create({
      data: { key: `rtb:ping:${pingId}`, response: payload as Prisma.InputJsonValue },
    });
    return pingId;
  }

  async loadPing(pingId: string) {
    const row = await this.prisma.idempotencyRecord.findUnique({ where: { key: `rtb:ping:${pingId}` } });
    return row?.response as Record<string, unknown> | null;
  }
}
