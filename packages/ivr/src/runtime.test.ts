import { describe, expect, it } from "vitest";
import { walkIvr, type IvrDocument } from "./index.js";

const disclosure: IvrDocument = {
  version: 1,
  nodes: [
    { id: "start", type: "start", data: {} },
    { id: "play", type: "play", data: { prompt: "This call may be recorded." } },
    { id: "age", type: "collect_digit", data: { key: "medicare", default: "1" } },
    { id: "check", type: "condition", data: { key: "medicare", equals: "1" } },
    { id: "route", type: "route", data: {} },
    { id: "end", type: "hangup", data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "play" },
    { id: "e2", source: "play", target: "age" },
    { id: "e3", source: "age", target: "check" },
    { id: "e4", source: "check", target: "route", label: "yes" },
    { id: "e5", source: "check", target: "end", label: "no" },
  ],
};

describe("IVR JSON runtime", () => {
  it("walks disclosure then routes on default digit", () => {
    const r = walkIvr(disclosure);
    expect(r.outcome).toBe("route");
    expect(r.path).toEqual(["start", "play", "age", "check", "route"]);
    expect(r.variables.medicare).toBe("1");
  });

  it("hangs up when the condition fails", () => {
    const r = walkIvr(disclosure, { digits: { age: "2" } });
    expect(r.outcome).toBe("hangup");
    expect(r.path.at(-1)).toBe("end");
  });
});
