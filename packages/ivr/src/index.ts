export type IvrNodeType =
  | "start"
  | "play"
  | "collect_digit"
  | "collect_speech"
  | "question"
  | "condition"
  | "set_variable"
  | "api_request"
  | "webhook"
  | "route"
  | "transfer"
  | "voicemail"
  | "hangup"
  | "ai_agent"
  | "human_agent";

export interface IvrNode {
  id: string;
  type: IvrNodeType;
  data: Record<string, unknown>;
}

export interface IvrEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface IvrDocument {
  version: number;
  nodes: IvrNode[];
  edges: IvrEdge[];
}

export function emptyIvr(): IvrDocument {
  return {
    version: 1,
    nodes: [{ id: "start", type: "start", data: {} }],
    edges: [],
  };
}
