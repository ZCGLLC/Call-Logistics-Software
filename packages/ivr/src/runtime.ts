import type { IvrDocument, IvrEdge, IvrNode } from "./types.js";

export interface IvrWalkInput {
  digits?: Record<string, string>;
  attributes?: Record<string, unknown>;
}

export interface IvrWalkResult {
  outcome: "route" | "hangup" | "transfer" | "voicemail";
  variables: Record<string, unknown>;
  path: string[];
  transferDid?: string;
}

function nextNode(nodes: Record<string, IvrNode>, edges: IvrEdge[], from: string, label?: string): IvrNode | undefined {
  const match =
    (label ? edges.find((e) => e.source === from && e.label === label) : undefined) ??
    edges.find((e) => e.source === from);
  return match ? nodes[match.target] : undefined;
}

/** Deterministic walker for a published IVR document. No I/O. */
export function walkIvr(doc: IvrDocument, input: IvrWalkInput = {}): IvrWalkResult {
  const nodes = Object.fromEntries(doc.nodes.map((n) => [n.id, n]));
  let current = doc.nodes.find((n) => n.type === "start") ?? doc.nodes[0];
  const variables: Record<string, unknown> = { ...(input.attributes ?? {}) };
  const path: string[] = [];
  let guard = 0;
  while (current && guard < 64) {
    guard += 1;
    path.push(current.id);
    switch (current.type) {
      case "hangup":
        return { outcome: "hangup", variables, path };
      case "voicemail":
        return { outcome: "voicemail", variables, path };
      case "route":
        return { outcome: "route", variables, path };
      case "transfer":
        return {
          outcome: "transfer",
          variables,
          path,
          transferDid: String(current.data.did ?? current.data.destination ?? ""),
        };
      case "set_variable":
        variables[String(current.data.key ?? "var")] = current.data.value;
        current = nextNode(nodes, doc.edges, current.id);
        break;
      case "collect_digit": {
        const key = String(current.data.key ?? "digit");
        variables[key] = input.digits?.[current.id] ?? current.data.default ?? "1";
        current = nextNode(nodes, doc.edges, current.id, String(variables[key]));
        break;
      }
      case "condition": {
        const key = String(current.data.key ?? "");
        const pass = String(variables[key] ?? "") === String(current.data.equals ?? "");
        current = nextNode(nodes, doc.edges, current.id, pass ? "yes" : "no");
        break;
      }
      default:
        current = nextNode(nodes, doc.edges, current.id);
        break;
    }
  }
  return { outcome: "route", variables, path };
}
