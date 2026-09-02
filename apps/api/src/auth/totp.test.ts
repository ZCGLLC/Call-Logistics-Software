import { describe, expect, it } from "vitest";
import { generateTotpSecret, totpCode, verifyTotp } from "./totp.js";

describe("TOTP", () => {
  it("verifies a current code", () => {
    const secret = generateTotpSecret();
    const code = totpCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
  });
});
