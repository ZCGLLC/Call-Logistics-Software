import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { Money, Permission, createPublicId, isBuyerRole, isPublisherRole } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";
import { buyerScope, callScope, publisherScope } from "../auth/tenant.js";
import { WebhookService } from "../webhooks/webhooks.service.js";

@Controller()
@UseGuards(AuthGuard)
export class BillingController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
  ) {}

  @Get("invoices")
  async invoices(@CurrentUser() user: AuthPrincipal) {
    assertPerm(user, Permission.FINANCIALS_READ);
    if (isPublisherRole(user.role)) return { data: [] };
    const data = await this.prisma.invoice.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.buyerId ? { buyerId: user.buyerId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { buyer: true, lines: true },
    });
    return { data };
  }

  @Post("invoices/generate")
  async generateInvoice(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.FINANCIALS_WRITE);
    const dto = z
      .object({
        buyerId: z.string(),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
      .parse(body);
    const buyer = await this.prisma.buyer.findFirstOrThrow({
      where: { ...buyerScope(user), OR: [{ id: dto.buyerId }, { publicId: dto.buyerId }] },
    });
    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);
    const calls = await this.prisma.call.findMany({
      where: {
        organizationId: user.organizationId,
        buyerId: buyer.id,
        converted: true,
        startedAt: { gte: start, lte: end },
      },
    });
    const gross = calls.reduce((acc, c) => acc.add(Money.from(String(c.revenue))), Money.zero());
    const invoice = await this.prisma.invoice.create({
      data: {
        publicId: createPublicId("inv"),
        organizationId: user.organizationId,
        buyerId: buyer.id,
        periodStart: start,
        periodEnd: end,
        grossAmount: gross.toFixed(4),
        adjustments: "0.0000",
        netAmount: gross.toFixed(4),
        status: "DRAFT",
        lines: {
          create: [
            {
              label: `Converted calls (${calls.length})`,
              quantity: calls.length,
              amount: gross.toFixed(4),
            },
          ],
        },
      },
      include: { lines: true, buyer: true },
    });
    await this.webhooks.emit(user.organizationId, "invoice.generated", { invoiceId: invoice.publicId });
    return invoice;
  }

  @Patch("invoices/:id")
  async patchInvoice(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    assertPerm(user, Permission.FINANCIALS_WRITE);
    const dto = z
      .object({
        status: z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED"]),
      })
      .parse(body);
    const invoice = await this.prisma.invoice.findFirstOrThrow({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
    });
    return this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: dto.status } });
  }

  @Get("invoices/:id/export.csv")
  async invoiceCsv(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Res() res: Response) {
    assertPerm(user, Permission.FINANCIALS_READ);
    const invoice = await this.prisma.invoice.findFirstOrThrow({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
      include: { buyer: true, lines: true },
    });
    const header = ["invoice_id", "buyer", "period_start", "period_end", "label", "quantity", "amount", "status"];
    const rows = invoice.lines.map((l) =>
      [
        invoice.publicId,
        invoice.buyer.company,
        invoice.periodStart.toISOString(),
        invoice.periodEnd.toISOString(),
        l.label,
        l.quantity,
        l.amount,
        invoice.status,
      ].join(","),
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${invoice.publicId}.csv`);
    res.send([header.join(","), ...rows].join("\n"));
  }

  @Get("statements")
  async statements(@CurrentUser() user: AuthPrincipal) {
    assertPerm(user, Permission.FINANCIALS_READ);
    if (isBuyerRole(user.role)) return { data: [] };
    const data = await this.prisma.statement.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.publisherId ? { publisherId: user.publisherId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { publisher: true },
    });
    return { data };
  }

  @Post("statements/generate")
  async generateStatement(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.FINANCIALS_WRITE);
    const dto = z
      .object({
        publisherId: z.string(),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
      .parse(body);
    const publisher = await this.prisma.publisher.findFirstOrThrow({
      where: { ...publisherScope(user), OR: [{ id: dto.publisherId }, { publicId: dto.publisherId }] },
    });
    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);
    const where = {
      organizationId: user.organizationId,
      publisherId: publisher.id,
      startedAt: { gte: start, lte: end },
    };
    const [accepted, rejected, sums] = await Promise.all([
      this.prisma.call.count({ where: { ...where, converted: true } }),
      this.prisma.call.count({ where: { ...where, converted: false } }),
      this.prisma.call.aggregate({ where: { ...where, converted: true }, _sum: { payout: true } }),
    ]);
    const payout = Money.from(String(sums._sum.payout ?? 0));
    return this.prisma.statement.create({
      data: {
        publicId: createPublicId("stmt"),
        organizationId: user.organizationId,
        publisherId: publisher.id,
        periodStart: start,
        periodEnd: end,
        acceptedCalls: accepted,
        rejectedCalls: rejected,
        payout: payout.toFixed(4),
        adjustments: "0.0000",
        status: "DRAFT",
      },
      include: { publisher: true },
    });
  }

  @Get("statements/:id/export.csv")
  async statementCsv(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Res() res: Response) {
    assertPerm(user, Permission.FINANCIALS_READ);
    const stmt = await this.prisma.statement.findFirstOrThrow({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
      include: { publisher: true },
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${stmt.publicId}.csv`);
    res.send(
      [
        "statement_id,publisher,period_start,period_end,accepted,rejected,payout,status",
        [
          stmt.publicId,
          stmt.publisher.company,
          stmt.periodStart.toISOString(),
          stmt.periodEnd.toISOString(),
          stmt.acceptedCalls,
          stmt.rejectedCalls,
          stmt.payout,
          stmt.status,
        ].join(","),
      ].join("\n"),
    );
  }

  @Get("disputes")
  async disputes(@CurrentUser() user: AuthPrincipal) {
    const calls = await this.prisma.call.findMany({
      where: callScope(user),
      select: { id: true },
    });
    const data = await this.prisma.dispute.findMany({
      where: { callId: { in: calls.map((c) => c.id) } },
      orderBy: { createdAt: "desc" },
      include: { call: { include: { publisher: true, buyer: true, campaign: true } } },
    });
    return { data };
  }

  @Post("disputes")
  async openDispute(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.DISPUTES_WRITE);
    const dto = z.object({ callId: z.string(), reason: z.string().min(1), notes: z.string().optional() }).parse(body);
    const call = await this.prisma.call.findFirstOrThrow({
      where: { ...callScope(user), OR: [{ id: dto.callId }, { publicId: dto.callId }] },
    });
    const dispute = await this.prisma.dispute.create({
      data: {
        publicId: createPublicId("dsp"),
        callId: call.id,
        reason: dto.reason,
        notes: dto.notes,
        status: "OPEN",
      },
    });
    await this.webhooks.emit(user.organizationId, "dispute.opened", { disputeId: dispute.publicId, callId: call.publicId });
    return dispute;
  }

  @Post("disputes/:id/resolve")
  async resolve(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    assertPerm(user, Permission.FINANCIALS_WRITE);
    const dto = z
      .object({
        status: z.enum(["CREDITED", "DENIED"]),
        credit: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(body);
    const dispute = await this.prisma.dispute.findFirstOrThrow({
      where: { OR: [{ id }, { publicId: id }] },
      include: { call: true },
    });
    if (dispute.call.organizationId !== user.organizationId) return { error: "forbidden" };
    const credit = dto.status === "CREDITED" ? Money.from(dto.credit ?? String(dispute.call.revenue)) : Money.zero();
    if (dto.status === "CREDITED") {
      const revenue = Money.from(String(dispute.call.revenue)).sub(credit);
      const payout = revenue.isZero() ? Money.zero() : Money.from(String(dispute.call.payout));
      const telecom = Money.from(String(dispute.call.telecomCost));
      const profit = revenue.sub(payout).sub(telecom);
      await this.prisma.call.update({
        where: { id: dispute.call.id },
        data: {
          revenue: revenue.toFixed(4),
          payout: payout.toFixed(4),
          profit: profit.toFixed(4),
          converted: !revenue.isZero() && !revenue.isNegative(),
          conversionReason: `dispute credit ${credit.toFixed(4)}`,
        },
      });
    }
    const updated = await this.prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: dto.status, credit: credit.toFixed(4), notes: dto.notes ?? dispute.notes },
    });
    await this.webhooks.emit(user.organizationId, "dispute.resolved", {
      disputeId: updated.publicId,
      status: updated.status,
    });
    return updated;
  }
}
