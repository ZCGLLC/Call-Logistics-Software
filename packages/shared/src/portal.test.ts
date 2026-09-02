import { describe, expect, it } from "vitest";
import { UserRole } from "./enums.js";
import { applyPortalRedaction, redactKpis } from "./portal.js";

describe("portal data hiding", () => {
  const call = {
    publicId: "call_1",
    callerE164: "+12145551234",
    buyer: { company: "Lone Star" },
    buyerId: "b1",
    publisher: { company: "Summit" },
    revenue: "42.0000",
    payout: "28.0000",
    profit: "13.9600",
    margin: "0.33",
    telecomCost: "0.0400",
    attempts: [{ buyerName: "Lone Star", buyerId: "b1", result: "ANSWERED" }],
  };

  it("hides buyer identity and margin from publishers", () => {
    const out = applyPortalRedaction({ role: UserRole.PUBLISHER_ADMIN, pii: true, publisherId: "p1" }, call);
    expect(out.buyer).toBeUndefined();
    expect(out.revenue).toBeNull();
    expect(out.profit).toBeNull();
    expect(out.payout).toBe("28.0000");
    expect((out.attempts as Array<{ buyerName: string }>)[0]?.buyerName).toBe("Destination 1");
    expect(out.callerE164).toBe("+12145551234");
  });

  it("hides publisher payout and margin from buyers", () => {
    const out = applyPortalRedaction({ role: UserRole.BUYER_ADMIN, pii: false, buyerId: "b1" }, call);
    expect(out.payout).toBeNull();
    expect(out.profit).toBeNull();
    expect(out.revenue).toBe("42.0000");
    expect((out.publisher as { company: string }).company).toBe("Publisher");
    expect(out.callerE164).toMatch(/\*\*\*/);
  });

  it("redacts KPI money the portal must not see", () => {
    const kpis = { revenue: "10", payout: "4", profit: "6", margin: "0.6", telecom: "0.04" };
    expect(redactKpis({ role: UserRole.PUBLISHER_USER, pii: false }, kpis).revenue).toBeNull();
    expect(redactKpis({ role: UserRole.BUYER_USER, pii: false }, kpis).payout).toBeNull();
    expect(redactKpis({ role: UserRole.SUPER_ADMIN, pii: true }, kpis).profit).toBe("6");
  });
});
