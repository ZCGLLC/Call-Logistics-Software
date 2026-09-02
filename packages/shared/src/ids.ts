import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 12);

export const IdPrefix = {
  org: "org",
  usr: "usr",
  team: "team",
  pub: "pub",
  buy: "buy",
  dst: "dst",
  vert: "vert",
  cam: "cam",
  did: "did",
  pool: "pool",
  call: "call",
  evt: "evt",
  att: "att",
  auc: "auc",
  bid: "bid",
  conv: "conv",
  lead: "lead",
  rec: "rec",
  txn: "txn",
  inv: "inv",
  stmt: "stmt",
  dsp: "dsp",
  wh: "wh",
  key: "key",
  tag: "tag",
  flag: "flag",
  ping: "ping",
} as const;

export type IdPrefixKey = keyof typeof IdPrefix;

export function createPublicId(prefix: IdPrefixKey): string {
  return `${IdPrefix[prefix]}_${nanoid()}`;
}

export function isPublicId(value: string, prefix?: IdPrefixKey): boolean {
  if (prefix) {
    return value.startsWith(`${IdPrefix[prefix]}_`) && value.length > 8;
  }
  return /^[a-z]+_[0-9a-z]{12}$/.test(value);
}
