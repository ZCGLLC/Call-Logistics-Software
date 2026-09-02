import type { IvrDocument } from "./types.js";

export type { IvrDocument, IvrEdge, IvrNode, IvrNodeType } from "./types.js";

export function emptyIvr(): IvrDocument {
  return {
    version: 1,
    nodes: [{ id: "start", type: "start", data: {} }],
    edges: [],
  };
}

export { walkIvr, type IvrWalkInput, type IvrWalkResult } from "./runtime.js";
