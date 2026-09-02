import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";
import { callScope, campaignScope, publisherScope, buyerScope, numberScope, redactRecord } from "../auth/tenant.js";
import { maskE164 } from "@zcg/shared";

@Controller("search")
@UseGuards(AuthGuard)
export class SearchController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async search(@CurrentUser() user: AuthPrincipal, @Query("q") q = "") {
    const term = q.trim();
    if (term.length < 2) return { data: [] };
    const [calls, campaigns, publishers, buyers, numbers, leads] = await Promise.all([
      this.prisma.call.findMany({
        where: {
          ...callScope(user),
          OR: [{ publicId: { contains: term } }, { callerE164: { contains: term } }],
        },
        take: 8,
        include: { campaign: true, publisher: true, buyer: true },
      }),
      this.prisma.campaign.findMany({
        where: { ...campaignScope(user), OR: [{ name: { contains: term, mode: "insensitive" } }, { publicId: { contains: term } }] },
        take: 6,
      }),
      user.buyerId
        ? []
        : this.prisma.publisher.findMany({
            where: { ...publisherScope(user), OR: [{ company: { contains: term, mode: "insensitive" } }, { publicId: { contains: term } }] },
            take: 6,
          }),
      user.publisherId
        ? []
        : this.prisma.buyer.findMany({
            where: { ...buyerScope(user), OR: [{ company: { contains: term, mode: "insensitive" } }, { publicId: { contains: term } }] },
            take: 6,
          }),
      this.prisma.trackingNumber.findMany({
        where: { ...numberScope(user), e164: { contains: term } },
        take: 6,
      }),
      this.prisma.lead.findMany({
        where: {
          organizationId: user.organizationId,
          ...(user.publisherId ? { publisherId: user.publisherId } : {}),
          OR: [{ publicId: { contains: term } }, { phone: { contains: term } }, { email: { contains: term } }],
        },
        take: 6,
      }),
    ]);
    return {
      data: [
        ...calls.map((c) =>
          redactRecord(user, {
            type: "call",
            id: c.publicId,
            href: `/calls/${c.publicId}`,
            label: c.publicId,
            detail: `${user.pii ? c.callerE164 : maskE164(c.callerE164)} · ${c.campaign.name}`,
          }),
        ),
        ...campaigns.map((c) => ({ type: "campaign", id: c.publicId, href: `/campaigns/${c.publicId}`, label: c.name, detail: c.routingStrategy })),
        ...(publishers as Array<{ publicId: string; company: string; status: string }>).map((p) => ({
          type: "publisher",
          id: p.publicId,
          href: `/publishers/${p.publicId}`,
          label: p.company,
          detail: p.status,
        })),
        ...(buyers as Array<{ publicId: string; company: string; status: string }>).map((b) => ({
          type: "buyer",
          id: b.publicId,
          href: `/buyers/${b.publicId}`,
          label: b.company,
          detail: b.status,
        })),
        ...numbers.map((n) => ({ type: "number", id: n.publicId, href: "/numbers", label: n.e164, detail: n.status })),
        ...leads.map((l) => ({ type: "lead", id: l.publicId, href: "/leads", label: l.publicId, detail: l.phone })),
      ],
    };
  }
}
