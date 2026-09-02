import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { createPublicId, Money } from "@zcg/shared";

const prisma = new PrismaClient();

function money(n: string) {
  return Money.from(n).toFixed(4);
}

function daysAgo(n: number, hour = 15): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 12, 0, 0);
  return d;
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set (see .env.example)");
  }

  await prisma.callEvent.deleteMany();
  await prisma.routingAttempt.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.conversion.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.call.deleteMany();
  await prisma.campaignBuyer.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.capPolicy.deleteMany();
  await prisma.trackingNumber.deleteMany();
  await prisma.buyerDestination.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.statement.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.publisher.deleteMany();
  await prisma.vertical.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      publicId: createPublicId("org"),
      name: "Zaidi Consulting Group",
      kind: "INTERNAL",
      timezone: "America/Chicago",
    },
  });

  const admin = await prisma.user.create({
    data: {
      publicId: createPublicId("usr"),
      email: email.toLowerCase(),
      passwordHash: await argon2.hash(password),
      name: "ZCG Super Admin",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.membership.create({
    data: { userId: admin.id, organizationId: org.id, role: "SUPER_ADMIN" },
  });

  const flags = ["RTB", "AI", "DIALER", "TRANSCRIPTION", "PUBLISHER_PORTAL", "BUYER_PORTAL", "PREDICTIVE_ROUTING", "DEMO"];
  for (const key of flags) {
    await prisma.featureFlag.create({
      data: { organizationId: org.id, key, enabled: key === "DEMO" || key === "RTB" },
    });
  }

  const verticalDefs: Array<[string, string]> = [
    ["medicare", "Medicare"],
    ["aca", "ACA"],
    ["final_expense", "Final Expense"],
    ["auto", "Auto Insurance"],
    ["home", "Home Insurance"],
    ["life", "Life Insurance"],
    ["solar", "Solar"],
    ["legal", "Legal"],
    ["debt", "Debt"],
    ["health", "Health"],
    ["other", "Other"],
  ];
  const verticals: Record<string, string> = {};
  for (const [slug, name] of verticalDefs) {
    const v = await prisma.vertical.create({ data: { organizationId: org.id, slug, name } });
    verticals[slug] = v.id;
  }

  const publisherSpecs = [
    { company: "Summit Media Partners", contact: "Priya Shah", email: "priya@summit.test", status: "ACTIVE" as const, verticals: ["medicare", "aca"] },
    { company: "Northline Traffic", contact: "James Cole", email: "james@northline.test", status: "ACTIVE" as const, verticals: ["final_expense"] },
    { company: "Harbor Digital", contact: "Elena Ruiz", email: "elena@harbor.test", status: "TESTING" as const, verticals: ["auto"] },
    { company: "Pinnacle Leads Co", contact: "Omar Haddad", email: "omar@pinnacle.test", status: "ACTIVE" as const, verticals: ["medicare", "final_expense"] },
    { company: "Cedar Peak Affiliates", contact: "Nina Park", email: "nina@cedar.test", status: "PAUSED" as const, verticals: ["aca"] },
  ];

  const publishers = [];
  for (const p of publisherSpecs) {
    publishers.push(
      await prisma.publisher.create({
        data: {
          publicId: createPublicId("pub"),
          organizationId: org.id,
          company: p.company,
          contactName: p.contact,
          email: p.email,
          phone: "+12145550100",
          status: p.status,
          paymentTerms: "NET_15",
          defaultPayoutModel: "DURATION",
          verticals: p.verticals,
          accountManagerId: admin.id,
        },
      }),
    );
  }

  const buyerSpecs = [
    {
      company: "Lone Star Health Connect",
      vertical: "medicare",
      states: ["TX", "OK", "LA"],
      revenue: "42.0000",
      threshold: 90,
      did: "+18005551001",
      dailyCap: 500,
    },
    {
      company: "Prairie Benefit Desk",
      vertical: "medicare",
      states: ["TX", "KS"],
      revenue: "35.0000",
      threshold: 90,
      did: "+18005551002",
      dailyCap: 400,
    },
    {
      company: "Atlas Final Expense",
      vertical: "final_expense",
      states: ["TX", "FL", "OH"],
      revenue: "14.0000",
      threshold: 10,
      did: "+18005551003",
      dailyCap: 800,
    },
    {
      company: "Gulf Auto Intake",
      vertical: "auto",
      states: ["TX", "FL"],
      revenue: "28.0000",
      threshold: 60,
      did: "+18005551004",
      dailyCap: 300,
    },
    {
      company: "Keystone ACA Floor",
      vertical: "aca",
      states: ["PA", "OH", "TX"],
      revenue: "31.0000",
      threshold: 90,
      did: "+18005551005",
      dailyCap: 250,
    },
  ];

  const buyers = [];
  for (const b of buyerSpecs) {
    const buyer = await prisma.buyer.create({
      data: {
        publicId: createPublicId("buy"),
        organizationId: org.id,
        company: b.company,
        contactName: "Intake Ops",
        email: `ops@${b.company.toLowerCase().replace(/\s+/g, "")}.test`,
        status: "ACTIVE",
        vertical: b.vertical,
        states: b.states,
        timezone: "America/Chicago",
        dailyCap: b.dailyCap,
        concurrentCap: 25,
        revenuePerCall: b.revenue,
        revenueModel: "DURATION",
        conversionModel: "DURATION",
        conversionThresholdSeconds: b.threshold,
        priority: 10,
        weight: 1,
      },
    });
    await prisma.buyerDestination.create({
      data: {
        publicId: createPublicId("dst"),
        buyerId: buyer.id,
        label: `${b.company} primary DID`,
        did: b.did,
        active: true,
      },
    });
    buyers.push(buyer);
  }

  const campaignDefs = [
    {
      name: "Medicare TX — Highest Revenue",
      vertical: "medicare",
      publisher: publishers[0]!,
      strategy: "HIGHEST_REVENUE" as const,
      buyerRev: "42.0000",
      pubPay: "28.0000",
      buyTh: 90,
      pubTh: 90,
      states: ["TX"],
      did: "+18005552001",
      buyers: [buyers[1]!, buyers[0]!],
      buyerRevs: ["35.0000", "42.0000"],
    },
    {
      name: "Final Expense Buffer",
      vertical: "final_expense",
      publisher: publishers[1]!,
      strategy: "HIGHEST_REVENUE" as const,
      buyerRev: "14.0000",
      pubPay: "10.0000",
      buyTh: 10,
      pubTh: 10,
      states: ["TX", "FL"],
      did: "+18005552002",
      buyers: [buyers[2]!],
      buyerRevs: ["14.0000"],
    },
    {
      name: "Medicare Waterfall",
      vertical: "medicare",
      publisher: publishers[3]!,
      strategy: "HIGHEST_REVENUE" as const,
      buyerRev: "45.0000",
      pubPay: "30.0000",
      buyTh: 90,
      pubTh: 90,
      states: ["TX"],
      did: "+18005552003",
      buyers: [buyers[0]!, buyers[1]!],
      buyerRevs: ["45.0000", "40.0000"],
    },
    {
      name: "ACA Midwest",
      vertical: "aca",
      publisher: publishers[4]!,
      strategy: "PRIORITY" as const,
      buyerRev: "31.0000",
      pubPay: "22.0000",
      buyTh: 90,
      pubTh: 90,
      states: ["PA", "OH", "TX"],
      did: "+18005552004",
      buyers: [buyers[4]!],
      buyerRevs: ["31.0000"],
    },
    {
      name: "Auto TX/FL",
      vertical: "auto",
      publisher: publishers[2]!,
      strategy: "MAX_GROSS_PROFIT" as const,
      buyerRev: "28.0000",
      pubPay: "18.0000",
      buyTh: 60,
      pubTh: 60,
      states: ["TX", "FL"],
      did: "+18005552005",
      buyers: [buyers[3]!],
      buyerRevs: ["28.0000"],
    },
  ];

  const campaigns = [];
  for (const c of campaignDefs) {
    const cam = await prisma.campaign.create({
      data: {
        publicId: createPublicId("cam"),
        organizationId: org.id,
        name: c.name,
        verticalId: verticals[c.vertical]!,
        publisherId: c.publisher.id,
        trafficSource: "Search",
        status: "ACTIVE",
        timezone: "America/Chicago",
        routingStrategy: c.strategy,
        dialMode: "WATERFALL",
        conversionModel: "DURATION",
        buyerThresholdSeconds: c.buyTh,
        publisherThresholdSeconds: c.pubTh,
        buyerRevenueAmount: c.buyerRev,
        publisherPayoutAmount: c.pubPay,
        estimatedTelecomCost: "0.0400",
        allowedStates: c.states,
        recordingEnabled: true,
        recordingDisclosure: "This call may be recorded for quality and compliance.",
      },
    });
    for (let i = 0; i < c.buyers.length; i++) {
      await prisma.campaignBuyer.create({
        data: {
          campaignId: cam.id,
          buyerId: c.buyers[i]!.id,
          priority: i + 1,
          weight: 1,
          revenueOverride: c.buyerRevs[i],
          allowedStates: c.states,
          active: true,
        },
      });
    }
    await prisma.trackingNumber.create({
      data: {
        publicId: createPublicId("did"),
        organizationId: org.id,
        e164: c.did,
        provider: "fake",
        campaignId: cam.id,
        publisherId: c.publisher.id,
        status: "ASSIGNED",
        numberType: "TOLL_FREE",
        monthlyCost: "1.0000",
      },
    });
    campaigns.push(cam);
  }

  const extraDest = await prisma.buyerDestination.create({
    data: {
      publicId: createPublicId("dst"),
      buyerId: buyers[2]!.id,
      label: "Waterfall C stand-in",
      did: "+18005551099",
      active: true,
    },
  });
  void extraDest;

  const states = ["TX", "FL", "OH", "PA", "OK"];
  const statuses = ["COMPLETED", "COMPLETED", "COMPLETED", "FAILED", "COMPLETED"] as const;

  for (let i = 0; i < 100; i++) {
    const cam = campaigns[i % campaigns.length]!;
    const pub = campaignDefs[i % campaignDefs.length]!.publisher;
    const buyer = campaignDefs[i % campaignDefs.length]!.buyers[0]!;
    const started = daysAgo(i % 28, 14 + (i % 6));
    const talk = 20 + (i * 7) % 160;
    const converted = talk >= cam.buyerThresholdSeconds && statuses[i % statuses.length] === "COMPLETED";
    const revenue = converted ? cam.buyerRevenueAmount : money("0");
    const payout = converted ? cam.publisherPayoutAmount : money("0");
    const telecom = "0.0400";
    const revM = Money.from(String(revenue));
    const payM = Money.from(String(payout));
    const telM = Money.from(telecom);
    const profit = revM.sub(payM).sub(telM);
    const ended = new Date(started.getTime() + (talk + 12) * 1000);
    const call = await prisma.call.create({
      data: {
        publicId: createPublicId("call"),
        organizationId: org.id,
        campaignId: cam.id,
        publisherId: pub.id,
        buyerId: converted || talk > 5 ? buyer.id : null,
        callerE164: `+1214555${String(1000 + i).padStart(4, "0")}`,
        callerState: states[i % states.length],
        callerZip: "75201",
        status: statuses[i % statuses.length],
        startedAt: started,
        answeredAt: new Date(started.getTime() + 8000),
        endedAt: ended,
        talkDurationSeconds: talk,
        totalDurationSeconds: talk + 12,
        revenue: revM.toFixed(4),
        payout: payM.toFixed(4),
        telecomCost: telM.toFixed(4),
        profit: profit.toFixed(4),
        margin: converted ? profit.toDecimal().div(revM.toDecimal()).toFixed(6) : "0",
        converted,
        convertedAt: converted ? ended : null,
        conversionReason: converted ? `duration ${talk}s` : talk < cam.buyerThresholdSeconds ? "below threshold" : null,
        routingExplanation: converted
          ? `Selected ${buyer.company} because highest eligible revenue.`
          : "Completed without conversion.",
      },
    });
    await prisma.callEvent.createMany({
      data: [
        { callId: call.id, seq: 1, type: "CALL_RECEIVED", at: started, payload: {} },
        { callId: call.id, seq: 2, type: "GEO_RESOLVED", at: new Date(started.getTime() + 500), payload: { state: call.callerState } },
        { callId: call.id, seq: 3, type: "ROUTING_STARTED", at: new Date(started.getTime() + 800), payload: {} },
        { callId: call.id, seq: 4, type: "BUYER_SELECTED", at: new Date(started.getTime() + 900), payload: { buyer: buyer.company } },
        { callId: call.id, seq: 5, type: "CALL_ENDED", at: ended, payload: { talk } },
      ],
    });
    if (converted) {
      await prisma.conversion.create({
        data: {
          publicId: createPublicId("conv"),
          callId: call.id,
          model: "DURATION",
          revenue: revM.toFixed(4),
          payout: payM.toFixed(4),
          telecom: telM.toFixed(4),
          profit: profit.toFixed(4),
          reason: `duration ${talk}s`,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`  Admin: ${email}`);
  console.log(`  Org: ${org.name} (${org.publicId})`);
  console.log(`  Publishers: ${publishers.length}`);
  console.log(`  Buyers: ${buyers.length}`);
  console.log(`  Campaigns: ${campaigns.length}`);
  console.log("  Sample calls: 100");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
