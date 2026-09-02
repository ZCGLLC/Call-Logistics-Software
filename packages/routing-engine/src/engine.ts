import { Money } from "@zcg/shared";
import { isOpenAt } from "./hours.js";
import type {
  DecisionTrace,
  DestinationSnapshot,
  RankedDestination,
  RejectedDestination,
  RoutingResult,
  RoutingSnapshot,
} from "./types.js";

function moneyStr(m: Money): string {
  return m.formatUsd(2);
}

function capHit(used: number, limit: number | null, label: string): string | null {
  if (limit === null) return null;
  if (used >= limit) return `${label} cap reached (${used}/${limit})`;
  return null;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectedProfit(d: DestinationSnapshot, snapshot: RoutingSnapshot): Money {
  const payout = d.payout.gt(Money.zero()) ? d.payout : snapshot.publisherPayout;
  const telecom = d.estimatedTelecom.gt(Money.zero())
    ? d.estimatedTelecom
    : snapshot.estimatedTelecomCost;
  return d.revenue.sub(payout).sub(telecom);
}

function expectedValue(d: DestinationSnapshot, snapshot: RoutingSnapshot): Money {
  const p = Math.min(1, Math.max(0, d.conversionProbability));
  return d.revenue.mul(p).sub(d.payout).sub(d.estimatedTelecom);
}

function predictiveScore(d: DestinationSnapshot): number {
  const epc = d.epc.toNumberUnsafe();
  const conv = d.conversionRate;
  const rev = d.revenue.toNumberUnsafe();
  const ans = d.answerRate;
  const match = 0.5;
  return 0.3 * epc + 0.25 * conv * 100 + 0.2 * rev + 0.15 * ans * 100 + 0.1 * match * 100;
}

export function route(snapshot: RoutingSnapshot): RoutingResult {
  const traces: DecisionTrace[] = [];
  const rejected: RejectedDestination[] = [];
  const eligibleDest: DestinationSnapshot[] = [];

  const pushTrace = (
    d: DestinationSnapshot,
    rule: string,
    input: string,
    expected: string,
    pass: boolean,
  ) => {
    traces.push({
      destinationId: d.id,
      buyerName: d.buyerName,
      rule,
      input,
      expected,
      pass,
    });
  };

  if (snapshot.call.isSuppressed) {
    return {
      eligible: [],
      rejected: snapshot.destinations.map((d) => ({
        destination: d,
        reasons: ["caller is on a suppression list"],
      })),
      strategy: snapshot.campaign.routingStrategy,
      explanation: "Call suppressed. No destinations eligible.",
      traces: [],
    };
  }

  if (snapshot.call.isDuplicate && snapshot.call.duplicateAction === "REJECT") {
    return {
      eligible: [],
      rejected: snapshot.destinations.map((d) => ({
        destination: d,
        reasons: ["duplicate caller rejected by campaign policy"],
      })),
      strategy: snapshot.campaign.routingStrategy,
      explanation: "Duplicate caller. Campaign policy is REJECT. No destinations eligible.",
      traces: [],
    };
  }

  for (const d of snapshot.destinations) {
    const reasons: string[] = [];

    if (!d.active) {
      reasons.push("destination inactive");
      pushTrace(d, "active", "false", "true", false);
    } else {
      pushTrace(d, "active", "true", "true", true);
    }

    if (d.verticalId && d.verticalId !== snapshot.campaign.verticalId) {
      reasons.push("vertical mismatch");
      pushTrace(d, "vertical", d.verticalId, snapshot.campaign.verticalId, false);
    } else {
      pushTrace(d, "vertical", d.verticalId, snapshot.campaign.verticalId, true);
    }

    const state = snapshot.call.state?.toUpperCase();
    if (d.allowedStates.length > 0) {
      const ok = !!state && d.allowedStates.map((s) => s.toUpperCase()).includes(state);
      pushTrace(d, "state", state ?? "(none)", d.allowedStates.join(","), ok);
      if (!ok) reasons.push(`${state ?? "(none)"} not accepted`);
    }

    if (snapshot.campaign.allowedStates && snapshot.campaign.allowedStates.length > 0) {
      const ok =
        !!state && snapshot.campaign.allowedStates.map((s) => s.toUpperCase()).includes(state);
      if (!ok) reasons.push(`campaign does not accept ${state ?? "(none)"}`);
    }

    if (d.allowedZips.length > 0) {
      const ok = !!snapshot.call.zip && d.allowedZips.includes(snapshot.call.zip);
      pushTrace(d, "zip", snapshot.call.zip ?? "(none)", d.allowedZips.join(","), ok);
      if (!ok) reasons.push("ZIP not accepted");
    }

    if (d.allowedAreaCodes.length > 0) {
      const ok = !!snapshot.call.areaCode && d.allowedAreaCodes.includes(snapshot.call.areaCode);
      pushTrace(d, "areaCode", snapshot.call.areaCode ?? "(none)", d.allowedAreaCodes.join(","), ok);
      if (!ok) reasons.push("area code not accepted");
    }

    if (d.allowedPublisherIds.length > 0) {
      const ok = d.allowedPublisherIds.includes(snapshot.call.publisherId);
      pushTrace(d, "publisher", snapshot.call.publisherId, d.allowedPublisherIds.join(","), ok);
      if (!ok) reasons.push("publisher not accepted");
    }

    if (d.allowedCampaignIds.length > 0) {
      const ok = d.allowedCampaignIds.includes(snapshot.call.campaignId);
      if (!ok) reasons.push("campaign not attached");
    }

    if (d.allowedTrafficSourceIds.length > 0 && snapshot.call.trafficSourceId) {
      const ok = d.allowedTrafficSourceIds.includes(snapshot.call.trafficSourceId);
      if (!ok) reasons.push("traffic source not accepted");
    }

    if (
      snapshot.call.isDuplicate &&
      snapshot.call.duplicateAction === "ROUTE_ELSEWHERE" &&
      snapshot.call.previousBuyerId &&
      d.buyerId === snapshot.call.previousBuyerId
    ) {
      reasons.push("duplicate: route elsewhere (prior buyer excluded)");
    }

    const hours = isOpenAt(d.hours, snapshot.now);
    pushTrace(d, "hours", hours.open ? "open" : (hours.reason ?? "closed"), "open", hours.open);
    if (!hours.open) reasons.push(hours.reason ?? "closed");

    const capReasons = [
      capHit(d.caps.concurrent, d.caps.concurrentLimit, "concurrent"),
      capHit(d.caps.hourly, d.caps.hourlyLimit, "hourly"),
      capHit(d.caps.daily, d.caps.dailyLimit, "daily"),
      capHit(d.caps.weekly, d.caps.weeklyLimit, "weekly"),
      capHit(d.caps.monthly, d.caps.monthlyLimit, "monthly"),
    ].filter((x): x is string => !!x);
    for (const c of capReasons) {
      reasons.push(c);
      pushTrace(d, "cap", c, "under cap", false);
    }
    if (capReasons.length === 0) {
      pushTrace(
        d,
        "cap",
        `daily ${d.caps.daily}/${d.caps.dailyLimit ?? "∞"}`,
        "under cap",
        true,
      );
    }

    if (d.minBid && d.bid.lt(d.minBid)) {
      reasons.push(`bid ${moneyStr(d.bid)} below minimum ${moneyStr(d.minBid)}`);
    }
    if (d.maxBid && d.bid.gt(d.maxBid)) {
      reasons.push(`bid ${moneyStr(d.bid)} above maximum ${moneyStr(d.maxBid)}`);
    }

    for (const [key, expected] of Object.entries(d.ivrPredicates)) {
      const actual = snapshot.call.ivr[key];
      const pass = actual === expected;
      pushTrace(d, `ivr.${key}`, String(actual), String(expected), pass);
      if (!pass) reasons.push(`IVR ${key} mismatch`);
    }

    if (reasons.length > 0) {
      rejected.push({ destination: d, reasons });
    } else {
      eligibleDest.push(d);
    }
  }

  const ranked = rank(eligibleDest, snapshot);
  const selected = ranked[0];
  const explanation = buildExplanation(rejected, ranked, snapshot.campaign.routingStrategy, selected);

  return {
    eligible: ranked,
    rejected,
    selected,
    strategy: snapshot.campaign.routingStrategy,
    explanation,
    traces,
  };
}

function rank(destinations: DestinationSnapshot[], snapshot: RoutingSnapshot): RankedDestination[] {
  const strategy = snapshot.campaign.routingStrategy;
  const scored = destinations.map((d) => {
    const gp = expectedProfit(d, snapshot);
    const ev = expectedValue(d, snapshot);
    let scoreNum = 0;
    switch (strategy) {
      case "PRIORITY":
        scoreNum = -d.priority;
        break;
      case "HIGHEST_REVENUE":
        scoreNum = d.revenue.toNumberUnsafe();
        break;
      case "HIGHEST_BID":
        scoreNum = d.bid.toNumberUnsafe();
        break;
      case "MAX_GROSS_PROFIT":
        scoreNum = gp.toNumberUnsafe();
        break;
      case "HIGHEST_EPC":
        scoreNum = d.epc.toNumberUnsafe();
        break;
      case "HIGHEST_CONVERSION":
        scoreNum = d.conversionRate;
        break;
      case "LEAST_UTILIZED":
        scoreNum = -d.utilization;
        break;
      case "ROUND_ROBIN":
        scoreNum = d.lastConnectedAt ? -new Date(d.lastConnectedAt).getTime() : 0;
        break;
      case "PREDICTIVE_SCORE":
        scoreNum = predictiveScore(d);
        break;
      case "EXPECTED_VALUE":
        scoreNum = ev.toNumberUnsafe();
        break;
      case "WEIGHTED":
        scoreNum = d.weight;
        break;
      default:
        scoreNum = d.revenue.toNumberUnsafe();
    }
    return { d, scoreNum, gp, ev };
  });

  if (strategy === "WEIGHTED" && scored.length > 0) {
    const rng = mulberry32(hashSeed(snapshot.call.id));
    const total = scored.reduce((s, x) => s + Math.max(0, x.d.weight), 0);
    let pick = rng() * (total || 1);
    let chosen = scored[0]!;
    for (const s of scored) {
      pick -= Math.max(0, s.d.weight);
      if (pick <= 0) {
        chosen = s;
        break;
      }
    }
    const rest = scored.filter((s) => s.d.id !== chosen.d.id).sort((a, b) => b.scoreNum - a.scoreNum);
    const ordered = [chosen, ...rest];
    return ordered.map((s, i) => toRanked(s, i));
  }

  scored.sort((a, b) => {
    if (b.scoreNum !== a.scoreNum) return b.scoreNum - a.scoreNum;
    return a.d.priority - b.d.priority || a.d.buyerName.localeCompare(b.d.buyerName);
  });
  return scored.map((s, i) => toRanked(s, i));
}

function toRanked(
  s: { d: DestinationSnapshot; scoreNum: number; gp: Money; ev: Money },
  i: number,
): RankedDestination {
  return {
    destination: s.d,
    score: String(s.scoreNum),
    rank: i + 1,
    expectedGrossProfit: s.gp,
    expectedValue: s.ev,
  };
}

function buildExplanation(
  rejected: RejectedDestination[],
  ranked: RankedDestination[],
  strategy: string,
  selected?: RankedDestination,
): string {
  const lines: string[] = [];
  for (const r of rejected) {
    lines.push(`${r.destination.buyerName} rejected: ${r.reasons.join("; ")}`);
  }
  for (const e of ranked) {
    const d = e.destination;
    lines.push(
      `${d.buyerName} accepted: open, geo ok, under cap, bid ${moneyStr(d.bid)}, revenue ${moneyStr(d.revenue)}, expected profit ${moneyStr(e.expectedGrossProfit)}`,
    );
  }
  if (selected) {
    const why: Record<string, string> = {
      HIGHEST_REVENUE: "highest eligible revenue",
      HIGHEST_BID: "highest eligible bid",
      PRIORITY: "highest priority (lowest priority number)",
      MAX_GROSS_PROFIT: "highest estimated gross profit",
      EXPECTED_VALUE: "highest expected value",
      WEIGHTED: "weighted selection (seeded by call id)",
      ROUND_ROBIN: "least recently connected",
      LEAST_UTILIZED: "lowest cap utilization",
      HIGHEST_EPC: "highest historical EPC",
      HIGHEST_CONVERSION: "highest historical conversion",
      PREDICTIVE_SCORE: "highest predictive score",
    };
    lines.push(`Selected ${selected.destination.buyerName} because ${why[strategy] ?? strategy}.`);
  } else {
    lines.push("No eligible destinations.");
  }
  return lines.join("\n");
}

export function explain(snapshot: RoutingSnapshot): RoutingResult {
  return route(snapshot);
}
